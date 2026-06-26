import { Router } from 'express';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/:ticket_id', async (req, res) => {
  const { ticket_id } = req.params;

  const { data, error: dbError } = await supabase
    .from('orders')
    .select('*, ticket_types(*, events(*))')
    .eq('ticket_id', ticket_id)
    .single();

  if (dbError) {
    if (dbError.code === 'PGRST116') {
      res.status(404).json(error('Ticket not found'));
      return;
    }
    console.error('Failed to fetch ticket:', dbError);
    res.status(500).json(error('Failed to fetch ticket'));
    return;
  }

  if (!data) {
    res.status(404).json(error('Ticket not found'));
    return;
  }

  res.json(success(data));
});

router.patch('/:ticket_id/scan', async (req, res) => {
  const { ticket_id } = req.params;
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('payment_status, scanned_at')
    .eq('ticket_id', ticket_id)
    .single();

  if (fetchErr || !order) {
    res.status(404).json(error('Ticket not found'));
    return;
  }

  if (order.payment_status !== 'approved') {
    res.status(400).json(error('Ticket is not approved'));
    return;
  }

  if (order.scanned_at) {
    res.status(409).json({
      success: false,
      error: 'Ticket already scanned',
      data: { scanned_at: order.scanned_at }
    });
    return;
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ scanned_at: now })
    .eq('ticket_id', ticket_id);

  if (updateErr) {
    res.status(500).json(error('Failed to scan ticket'));
    return;
  }

  res.json(success({ message: 'Ticket marked as used', scanned_at: now }));
});

router.post('/scan', requireRole('admin', 'scanner'), async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json(error('Token is required'));
    return;
  }

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select(`
      id,
      ticket_id,
      buyer_name,
      quantity,
      payment_status,
      scanned_at,
      ticket_types (
        name,
        events ( name, date, venue, city, organizer_phone, location_link, terms_conditions )
      )
    `)
    .eq('scan_token', token)
    .single();

  if (fetchErr || !order) {
    res.status(404).json({ success: false, error: 'Invalid token' });
    return;
  }

  if (order.payment_status !== 'approved') {
    res.status(400).json({ success: false, error: 'Ticket is not approved' });
    return;
  }

  if (order.scanned_at) {
    res.status(409).json({
      success: false,
      error: 'Ticket already scanned',
      data: { scanned_at: order.scanned_at },
    });
    return;
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ scanned_at: now })
    .eq('id', order.id);

  if (updateErr) {
    res.status(500).json(error('Failed to scan ticket'));
    return;
  }

  res.json({
    success: true,
    data: {
      ticket_id: order.ticket_id,
      buyer_name: order.buyer_name,
      quantity: order.quantity,
      ticket_type: order.ticket_types?.[0]?.name,
      event_name: order.ticket_types?.[0]?.events?.[0]?.name,
      event_date: order.ticket_types?.[0]?.events?.[0]?.date,
      venue: order.ticket_types?.[0]?.events?.[0]?.venue,
      scanned_at: now,
    },
  });
});

router.post('/reset-scan', requireRole('admin', 'scanner'), async (req, res) => {
  const { token, resetPassword } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json(error('Token is required'));
    return;
  }

  if (!resetPassword || typeof resetPassword !== 'string') {
    res.status(400).json(error('Reset password is required'));
    return;
  }

  if (!process.env.SCAN_RESET_PASSWORD) {
    res.status(500).json(error('Scan reset feature not configured'));
    return;
  }

  if (resetPassword !== process.env.SCAN_RESET_PASSWORD) {
    res.status(403).json(error('Incorrect reset password'));
    return;
  }

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id')
    .eq('scan_token', token)
    .single();

  if (fetchErr || !order) {
    res.status(404).json(error('Ticket not found'));
    return;
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({ scanned_at: null })
    .eq('id', order.id);

  if (updateErr) {
    console.error('Failed to reset scan:', updateErr);
    res.status(500).json(error('Failed to reset scan'));
    return;
  }

  res.json(success({ message: 'Ticket scan reset successfully' }));
});

export default router;
