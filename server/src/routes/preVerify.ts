import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { MS } from '../lib/constants';
import { sendVerificationEmail } from '../services/email';

const router = Router();

const VERIFICATION_SALT = process.env.VERIFICATION_SALT || 'fallback-salt';
const CODE_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHmac('sha256', VERIFICATION_SALT).update(code).digest('hex');
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

const sendLimiter = rateLimit({
  windowMs: MS.FIFTEEN_MINUTES,
  max: 10,
  message: { success: false, error: 'Too many verification requests' },
});

router.post('/send', sendLimiter, body('email').isEmail(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { email } = req.body as { email: string };
  const code = generateCode();
  const hash = hashCode(code);

  await supabase
    .from('email_verifications')
    .delete()
    .eq('email', email);

  const { error: insertErr } = await supabase
    .from('email_verifications')
    .insert({
      email,
      code_hash: hash,
      attempts: 0,
      sent_at: new Date().toISOString(),
      verified: false,
    });

  if (insertErr) {
    console.error('Failed to store verification code:', insertErr.message, insertErr.details);
    res.status(500).json(error('Failed to send verification code'));
    return;
  }

  const emailPromise = sendVerificationEmail({
    buyer_name: 'there',
    buyer_email: email,
    ticket_id: 'pre-verify',
    verification_code: code,
  });

  const timeoutMs = 10_000;
  const emailResult = await Promise.race([
    emailPromise,
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);

  if (emailResult) {
    res.json(success({ message: 'Verification code sent' }));
  } else {
    res.status(500).json(error('Could not send verification code. Please check your email address and try again.'));
  }
});

router.post('/confirm', body('email').isEmail(), body('code').matches(/^\d{6}$/), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { email, code } = req.body as { email: string; code: string };

  const { data: record, error: fetchErr } = await supabase
    .from('email_verifications')
    .select('*')
    .eq('email', email)
    .single();

  if (fetchErr || !record) {
    res.status(404).json(error('No verification code found. Request a new one.'));
    return;
  }

  if (record.verified) {
    res.json(success({ message: 'Email already verified' }));
    return;
  }

  const elapsed = Date.now() - new Date(record.sent_at).getTime();
  if (elapsed > CODE_EXPIRY_MS) {
    res.status(410).json(error('Code expired. Request a new one.'));
    return;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    res.status(429).json(error('Too many attempts. Request a new code.'));
    return;
  }

  if (hashCode(code) !== record.code_hash) {
    await supabase
      .from('email_verifications')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id);

    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    res.status(400).json(error(`Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`));
    return;
  }

  await supabase
    .from('email_verifications')
    .update({ verified: true, attempts: 0 })
    .eq('id', record.id);

  res.json(success({ message: 'Email verified successfully' }));
});

export default router;
