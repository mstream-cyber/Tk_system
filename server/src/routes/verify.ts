import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { MS } from '../lib/constants';
import { sendVerificationEmail, sendTicketEmail } from '../services/email';
import type { Order } from '../services/email';

const router = Router();

const VERIFICATION_SALT = process.env.VERIFICATION_SALT || 'fallback-salt';
const CODE_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashCode(code: string): string {
  return crypto.createHmac('sha256', VERIFICATION_SALT).update(code).digest('hex');
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

const resendLimiter = rateLimit({
  windowMs: MS.FIFTEEN_MINUTES,
  max: 10,
  message: { success: false, error: 'Too many resend requests' },
});

router.post('/:order_id', [
  body('code').matches(/^\d{6}$/).withMessage('Code must be a 6-digit number'),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { order_id } = req.params;
  const { code } = req.body;

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, email_verified, verification_code_hash, verification_attempts, verification_code_sent_at')
    .eq('id', order_id)
    .single();

  if (fetchErr || !order) {
    res.status(404).json(error('Order not found'));
    return;
  }

  if (order.email_verified) {
    res.status(400).json(error('Email already verified'));
    return;
  }

  if (order.verification_attempts >= MAX_ATTEMPTS) {
    res.status(429).json(error('Too many attempts. Please request a new code.'));
    return;
  }

  if (order.verification_attempts === 0 && !order.verification_code_hash) {
    res.status(400).json(error('No verification code sent yet'));
    return;
  }

  if (order.verification_code_sent_at) {
    const elapsed = Date.now() - new Date(order.verification_code_sent_at).getTime();
    if (elapsed > CODE_EXPIRY_MS) {
      res.status(410).json(error('Code expired. Request a new one.'));
      return;
    }
  }

  if (hashCode(code) !== order.verification_code_hash) {
    await supabase
      .from('orders')
      .update({ verification_attempts: order.verification_attempts + 1 })
      .eq('id', order_id);

    const remaining = MAX_ATTEMPTS - (order.verification_attempts + 1);
    res.status(400).json(error(`Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`));
    return;
  }

  await supabase
    .from('orders')
    .update({
      email_verified: true,
      verification_code_hash: null,
    })
    .eq('id', order_id);

  const { data: fullOrder } = await supabase
    .from('orders')
    .select('*, ticket_types(name, price, events(name, date, time, venue, city, organizer_phone, location_link, terms_conditions))')
    .eq('id', order_id)
    .single();

  if (fullOrder && fullOrder.payment_status === 'approved') {
    const emailOrder: Order = {
      id: fullOrder.id,
      ticket_id: fullOrder.ticket_id,
      scan_token: fullOrder.scan_token,
      buyer_name: fullOrder.buyer_name,
      buyer_email: fullOrder.buyer_email,
      quantity: fullOrder.quantity,
      total_amount: fullOrder.total_amount,
      payment_method: fullOrder.payment_method,
      ticket_types: fullOrder.ticket_types,
    };
    sendTicketEmail(emailOrder).catch((err) =>
      console.error(`Failed to send ticket email after verification for order ${fullOrder.id}:`, err)
    );
  }

  res.json(success({ message: 'Email verified successfully' }));
});

router.post('/:order_id/resend', resendLimiter, async (req: Request, res: Response) => {
  const { order_id } = req.params;

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, email_verified, verification_code_sent_at, buyer_name, buyer_email, ticket_type_id')
    .eq('id', order_id)
    .single();

  if (fetchErr || !order) {
    res.status(404).json(error('Order not found'));
    return;
  }

  if (order.email_verified) {
    res.status(400).json(error('Email already verified'));
    return;
  }

  if (order.verification_code_sent_at) {
    const elapsed = Date.now() - new Date(order.verification_code_sent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      res.status(429).json(error(`Please wait ${waitSec}s before requesting a new code`));
      return;
    }
  }

  const newCode = generateCode();
  const newHash = hashCode(newCode);

  await supabase
    .from('orders')
    .update({
      verification_code_hash: newHash,
      verification_attempts: 0,
      verification_code_sent_at: new Date().toISOString(),
    })
    .eq('id', order_id);

  const emailPromise = sendVerificationEmail({
    buyer_name: String(order.buyer_name),
    buyer_email: String(order.buyer_email),
    ticket_id: String(order_id),
    verification_code: newCode,
  });

  const timeoutMs = 10_000;
  const emailResult = await Promise.race([
    emailPromise,
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);

  if (emailResult) {
    res.json(success({ message: 'Verification code sent' }));
  } else {
    res.status(500).json(error('Failed to send verification code. Please try again.'));
  }
});

export default router;
