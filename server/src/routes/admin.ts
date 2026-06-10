import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { authMiddleware, generateToken } from '../middleware/auth';
import { sendTicketEmail, sendRejectionEmail } from '../services/email';
import type { Order } from '../services/email';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts' }
});

router.post('/login', loginLimiter, (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || password !== adminPassword) {
    res.status(401).json(error('Invalid password'));
    return;
  }
  const token = generateToken();
  res.json(success({ token }));
});

router.use(authMiddleware);

router.get('/orders', async (req: Request, res: Response) => {
  const status = (req.query.status as string) || '';
  const search = (req.query.search as string) || '';
  const type = (req.query.type as string) || '';

  let queryBuilder = supabase
    .from('orders')
    .select(`*, ticket_types ( name, price, events ( name, date, venue, city ) )`)
    .order('created_at', { ascending: false });

  if (status) queryBuilder = queryBuilder.eq('payment_status', status);
  if (search) queryBuilder = queryBuilder.or(`buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%,ticket_id.ilike.%${search}%`);
  const { data: orders, error: fetchErr } = await queryBuilder;
  if (fetchErr) { res.status(500).json(error('Failed to fetch orders')); return; }
  let result = orders ?? [];
  if (type) {
    result = result.filter((o) => o.ticket_types?.name === type);
  }
  res.json(success(result));
});

router.get('/orders/:order_id/receipt', async (req: Request, res: Response) => {
  const { order_id } = req.params;
  const { data: order, error: fetchErr } = await supabase.from('orders').select('receipt_url').eq('id', order_id).single();
  if (fetchErr || !order || !order.receipt_url) { res.status(404).json(error('Receipt not found')); return; }
  const { data: signedUrl, error: signErr } = await supabase.storage.from('payment-receipts').createSignedUrl(order.receipt_url, 3600);
  if (signErr || !signedUrl) { res.status(500).json(error('Failed to generate receipt URL')); return; }
  res.json(success({ url: signedUrl.signedUrl }));
});

router.post('/orders/:order_id/approve', async (req: Request, res: Response) => {
  const { order_id } = req.params;
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select(`*, ticket_types ( name, price, events ( name, date, venue, city ) )`)
    .eq('id', order_id).single();
  if (fetchErr || !order) { res.status(404).json(error('Order not found')); return; }
  if (order.payment_status !== 'receipt_uploaded') { res.status(400).json(error('Order must be in receipt_uploaded status')); return; }
  const { error: updateErr } = await supabase.from('orders').update({ payment_status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' }).eq('id', order_id);
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
  const { data: allOrders, error: fetchErr } = await supabase.from('orders').select('payment_status, total_amount');
  if (fetchErr) { res.status(500).json(error('Failed to fetch stats')); return; }
  const pending_count = allOrders.filter((o) => o.payment_status === 'pending').length;
  const receipt_uploaded_count = allOrders.filter((o) => o.payment_status === 'receipt_uploaded').length;
  const approved_count = allOrders.filter((o) => o.payment_status === 'approved').length;
  const rejected_count = allOrders.filter((o) => o.payment_status === 'rejected').length;
  const total_revenue_approved = allOrders.filter((o) => o.payment_status === 'approved').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  res.json(success({ total_orders: allOrders.length, pending_count, receipt_uploaded_count, approved_count, rejected_count, total_revenue_approved }));
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
