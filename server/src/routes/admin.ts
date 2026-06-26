import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { requireRole, generateToken } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { MS } from '../lib/constants';
import { sendTicketEmail, sendRejectionEmail } from '../services/email';
import { generateTicketId } from '../utils/ticketId';
import { generateScanToken } from '../utils/scanToken';
import type { Order } from '../services/email';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: MS.ONE_HOUR,
  max: 10,
  message: { success: false, error: 'Too many login attempts' }
});

const scanPinLimiter = rateLimit({
  windowMs: MS.FIFTEEN_MINUTES,
  max: 5,
  message: { success: false, error: 'Too many PIN attempts' }
});

router.post('/login', loginLimiter, (req: Request, res: Response) => {
  const { password } = req.body;
  if (typeof password !== 'string' || !password.trim()) {
    res.status(400).json(error('Password is required'));
    return;
  }
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || password !== adminPassword) {
    res.status(401).json(error('Invalid password'));
    return;
  }
  const token = generateToken('admin');
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MS.EIGHT_HOURS,
    path: '/',
  });
  res.json(success({ message: 'Login successful' }));
});

router.use(requireRole('admin'));

router.get('/orders', async (req: Request, res: Response) => {
  const status = (req.query.status as string) || '';
  const search = (req.query.search as string) || '';
  const type = (req.query.type as string) || '';
  const method = (req.query.method as string) || '';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const { count: total } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  let queryBuilder = supabase
    .from('orders')
    .select(`*, ticket_types ( name, price, events ( name, date, venue, city ) )`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) queryBuilder = queryBuilder.eq('payment_status', status);
  if (method) queryBuilder = queryBuilder.eq('payment_method', method);
  if (search) queryBuilder = queryBuilder.or(`buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%,ticket_id.ilike.%${search}%`);
  const { data: orders, error: fetchErr } = await queryBuilder;
  if (fetchErr) { res.status(500).json(error('Failed to fetch orders')); return; }
  let result = orders ?? [];
  if (type) {
    result = result.filter((o) => o.ticket_types?.name === type);
  }
  res.json(success({ orders: result, total: total ?? 0, page, limit }));
});

router.get('/orders/:order_id/receipt', async (req: Request, res: Response) => {
  const { order_id } = req.params;
  const { data: order, error: fetchErr } = await supabase.from('orders').select('receipt_url').eq('id', order_id).single();
  if (fetchErr || !order || !order.receipt_url) { res.status(404).json(error('Receipt not found')); return; }
  const { data: signedUrl, error: signErr } = await supabase.storage.from('payment-receipts').createSignedUrl(order.receipt_url, 3600);
  if (signErr || !signedUrl) { res.status(500).json(error('Failed to generate receipt URL')); return; }
  res.json(success({ url: signedUrl.signedUrl }));
});

router.post('/orders/:order_id/approve', async (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select(`*, ticket_types ( name, price, events ( name, date, venue, city ) )`)
    .eq('id', order_id).single();
  if (fetchErr || !order) { res.status(404).json(error('Order not found')); return; }
  if (order.payment_status !== 'receipt_uploaded') { res.status(400).json(error('Order must be in receipt_uploaded status')); return; }
  const { error: updateErr } = await supabase.from('orders').update({ payment_status: 'approved', approved_at: new Date().toISOString(), approved_by: req.admin?.role || 'admin' }).eq('id', order_id);
  if (updateErr) { res.status(500).json(error('Failed to approve order')); return; }
  const emailOrder: Order = { id: order.id, ticket_id: order.ticket_id, scan_token: order.scan_token, buyer_name: order.buyer_name, buyer_email: order.buyer_email, quantity: order.quantity, total_amount: order.total_amount, payment_method: order.payment_method, ticket_types: order.ticket_types };
  sendTicketEmail(emailOrder).catch((err) => console.error(`Failed to send ticket email for order ${order_id}:`, err));
  res.json(success({ message: 'Order approved and ticket email sent' }));
});

router.post('/orders/:order_id/reject', body('reason').trim().notEmpty().withMessage('Reason is required'), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json(error(errors.array().map((e) => e.msg).join('; '))); return; }
  const { order_id } = req.params;
  const { reason } = req.body;
  const { data: order, error: fetchErr } = await supabase.from('orders').select('*').eq('id', order_id).single();
  if (fetchErr || !order) { res.status(404).json(error('Order not found')); return; }
  if (order.payment_status !== 'receipt_uploaded') { res.status(400).json(error('Order must be in receipt_uploaded status')); return; }
  const { error: updateErr } = await supabase.from('orders').update({ payment_status: 'rejected', rejected_at: new Date().toISOString() }).eq('id', order_id);
  if (updateErr) { res.status(500).json(error('Failed to reject order')); return; }
  const emailOrder: Order = { id: order.id, ticket_id: order.ticket_id, buyer_name: order.buyer_name, buyer_email: order.buyer_email, quantity: order.quantity, total_amount: order.total_amount, payment_method: order.payment_method };
  sendRejectionEmail(emailOrder, reason).catch((err) => console.error(`Failed to send rejection email for order ${order_id}:`, err));
  res.json(success({ message: 'Order rejected and notification sent' }));
});

router.get('/stats', async (_req: Request, res: Response) => {
  const { data: statsResult, error: rpcErr } = await supabase.rpc('get_order_stats');
  if (rpcErr || !statsResult) {
    res.status(500).json(error('Failed to fetch stats'));
    return;
  }
  res.json(success(statsResult));
});

router.post('/verify-scan-pin', scanPinLimiter, (req: Request, res: Response) => {
  const { pin } = req.body;
  if (typeof pin !== 'string' || !pin.trim()) {
    res.status(400).json(error('PIN is required'));
    return;
  }
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || pin !== adminPassword) {
    res.status(401).json(error('Invalid PIN'));
    return;
  }
  const token = generateToken('scanner');
  res.cookie('scanner_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MS.FIFTEEN_MINUTES,
    path: '/',
  });
  res.json(success({ token }));
});

router.post('/gate-sales',
  body('ticket_type_id').isUUID().withMessage('Valid ticket type ID is required'),
  body('quantity').isInt({ min: 1, max: 10 }).withMessage('Quantity must be 1-10'),
  body('buyer_name').trim().isLength({ min: 1, max: 200 }).withMessage('Buyer name is required (max 200 chars)'),
  body('buyer_email').isEmail().withMessage('Valid email is required'),
  body('buyer_phone').trim().isLength({ min: 1, max: 20 }).withMessage('Phone is required (max 20 chars)'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
      return;
    }

    const { ticket_type_id, quantity, buyer_name, buyer_email, buyer_phone, buyer_city } = req.body;

    const { data: ticketType, error: ttErr } = await supabase
      .from('ticket_types')
      .select('*, events!inner(*)')
      .eq('id', ticket_type_id)
      .single();

    if (ttErr || !ticketType) {
      res.status(404).json(error('Ticket type not found'));
      return;
    }

    if (ticketType.status !== 'active') {
      res.status(400).json(error('Ticket type is not active'));
      return;
    }

    if (ticketType.available_quantity < quantity) {
      res.status(409).json(error('Not enough available tickets'));
      return;
    }

    const total_amount = ticketType.price * quantity;
    const ticket_id = generateTicketId();
    const scan_token = generateScanToken();
    const now = new Date().toISOString();

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
        payment_method: 'cash',
        payment_status: 'approved',
        approved_at: now,
        approved_by: req.admin?.role || 'admin',
        ticket_id,
        scan_token,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Failed to create gate sale order:', insertErr.message || 'Unknown error');
      res.status(500).json(error('Failed to create order'));
      return;
    }

    const { error: decErr } = await supabase
      .from('ticket_types')
      .update({ available_quantity: ticketType.available_quantity - quantity })
      .eq('id', ticket_type_id)
      .eq('available_quantity', ticketType.available_quantity);

    if (decErr) {
      await supabase.from('orders').delete().eq('id', order.id);
      console.error('Failed to decrement inventory:', decErr.message || 'Unknown error');
      res.status(409).json(error('Inventory conflict, please retry'));
      return;
    }

    const emailOrder: Order = {
      id: order.id,
      ticket_id: order.ticket_id,
      scan_token: order.scan_token,
      buyer_name: order.buyer_name,
      buyer_email: order.buyer_email,
      quantity: order.quantity,
      total_amount: order.total_amount,
      payment_method: 'cash',
      ticket_types: ticketType,
    };
    sendTicketEmail(emailOrder).catch((err) => console.error(`Failed to send ticket email for gate sale ${order.id}:`, err));

    res.json(success({
      order_id: order.id,
      ticket_id: order.ticket_id,
      buyer_name: order.buyer_name,
      ticket_type: ticketType.name,
      event_name: ticketType.events?.name,
      total_amount,
    }));
  });

router.post('/resend/:order_id', async (req: Request, res: Response) => {
  const { order_id } = req.params;
  const { data: order, error: fetchErr } = await supabase.from('orders').select(`*, ticket_types ( name, price, events ( name, date, venue, city ) )`).eq('id', order_id).single();
  if (fetchErr || !order) { res.status(404).json(error('Order not found')); return; }
  if (order.payment_status !== 'approved') { res.status(400).json(error('Can only resend tickets for approved orders')); return; }
  const emailOrder: Order = { id: order.id, ticket_id: order.ticket_id, scan_token: order.scan_token, buyer_name: order.buyer_name, buyer_email: order.buyer_email, quantity: order.quantity, total_amount: order.total_amount, payment_method: order.payment_method, ticket_types: order.ticket_types };
  sendTicketEmail(emailOrder).catch((err) => console.error(`Failed to resend ticket email for order ${order_id}:`, err));
  res.json(success({ message: 'Ticket email resent' }));
});

router.get('/export', async (_req: Request, res: Response) => {
  const { data: orders, error: fetchErr } = await supabase.from('orders').select(`*, ticket_types ( name, price, events ( name, date, venue, city ) )`).order('created_at', { ascending: false });
  if (fetchErr) { res.status(500).json(error('Failed to export orders')); return; }
  const headers = ['Ticket ID', 'Buyer Name', 'Email', 'Phone', 'City', 'Event', 'Ticket Type', 'Quantity', 'Total Amount (PKR)', 'Payment Method', 'Payment Status', 'Created At'];
  const rows = orders.map((o) => [o.ticket_id, o.buyer_name, o.buyer_email, o.buyer_phone, o.buyer_city || '', o.ticket_types?.events?.name || '', o.ticket_types?.name || '', o.quantity, (o.total_amount / 100).toFixed(2), o.payment_method, o.payment_status, o.created_at]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
  res.send(csv);
});

export default router;
