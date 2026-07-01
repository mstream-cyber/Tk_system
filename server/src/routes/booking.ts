import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { generateTicketId } from '../utils/ticketId';
import { generateScanToken } from '../utils/scanToken';
import { sendNewOrderNotification } from '../services/email';

const router = Router();

const validate = [
  body('ticket_type_id').isUUID().withMessage('ticket_type_id must be a valid UUID'),
  body('buyer_name').trim().isLength({ min: 1, max: 200 }).withMessage('buyer_name is required (max 200 chars)'),
  body('buyer_email').isEmail().withMessage('buyer_email must be a valid email'),
  body('buyer_phone').trim().isLength({ min: 1, max: 20 }).withMessage('buyer_phone is required (max 20 chars)'),
  body('buyer_city').optional().trim().isLength({ max: 100 }).withMessage('buyer_city too long'),
  body('quantity').isInt({ min: 1, max: 10 }).withMessage('quantity must be between 1 and 10'),
  body('payment_method')
    .isIn(['bank_transfer', 'easypaisa'])
    .withMessage('payment_method must be bank_transfer or easypaisa'),
];

router.post('/', validate, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { ticket_type_id, buyer_name, buyer_email, buyer_phone, buyer_city, quantity, payment_method } = req.body;

  const { data: ticketType, error: fetchErr } = await supabase
    .from('ticket_types')
    .select('*, events!inner(name)')
    .eq('id', ticket_type_id)
    .single();

  if (fetchErr || !ticketType) {
    res.status(404).json(error('Ticket type not found'));
    return;
  }

  if (ticketType.available_quantity < quantity) {
    res.status(400).json(error('Not enough tickets available'));
    return;
  }

  const ticket_id = generateTicketId();
  const total_amount = ticketType.price * quantity;

  const { data: order, error: insertErr } = await supabase
    .from('orders')
    .insert({
      ticket_type_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_city: buyer_city || null,
      quantity,
      total_amount,
      payment_method,
      payment_status: 'pending',
      scan_token: generateScanToken(),
      ticket_id,
    })
    .select()
    .single();

  if (insertErr || !order) {
    console.error('Failed to insert order:', insertErr?.message || 'Unknown error');
    res.status(500).json(error('Failed to create order'));
    return;
  }

  const newAvailable = ticketType.available_quantity - quantity;
  const { data: updated, error: updateErr } = await supabase
    .from('ticket_types')
    .update({ available_quantity: newAvailable })
    .eq('id', ticket_type_id)
    .eq('available_quantity', ticketType.available_quantity)
    .select();

  if (updateErr || !updated || updated.length === 0) {
    await supabase.from('orders').delete().eq('id', order.id);
    res.status(409).json(error('Inventory changed, please retry'));
    return;
  }

  const notifyTo = process.env.NOTIFY_EMAIL
  if (notifyTo) {
    sendNewOrderNotification({
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_city,
      ticket_type_name: ticketType.name,
      event_name: (ticketType as any).events?.name || 'Event',
      quantity,
      total_amount,
      ticket_id,
      order_id: order.id,
      payment_method,
    }).catch((err) => console.error('Failed to send order notification:', err))
  }

  res.status(201).json(success({
    order_id: order.id,
    ticket_id: order.ticket_id,
  }));
});

export default router;
