import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { requireRole } from '../middleware/auth';
import { FILE, MS } from '../lib/constants';

const router = Router();
router.use(requireRole('admin'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE.MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    if (FILE.ALLOWED_BANNER_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'));
    }
  },
});

function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  return null;
}

// ── Events CRUD ──

router.get('/', async (_req: Request, res: Response) => {
  const { data, error: dbError } = await supabase
    .from('events')
    .select('*, ticket_types(*)')
    .order('date', { ascending: true });

  if (dbError) {
    res.status(500).json(error('Failed to fetch events'));
    return;
  }

  res.json(success(data));
});

const eventValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('date').trim().notEmpty().withMessage('date is required'),
  body('time').trim().notEmpty().withMessage('time is required'),
  body('venue').trim().notEmpty().withMessage('venue is required'),
  body('city').trim().notEmpty().withMessage('city is required'),
  body('description').optional().trim().isString(),
  body('status').optional().isIn(['draft', 'published', 'cancelled']),
  body('max_tickets_per_order').optional().isInt({ min: 1 }),
  body('organizer_phone').optional().trim().isString(),
  body('location_link').optional().trim().isString(),
  body('terms_conditions').optional().trim().isString(),
];

router.post('/', eventValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { name, date, time, venue, city, description, status, max_tickets_per_order, organizer_phone } = req.body;

  const { data: event, error: insertErr } = await supabase
    .from('events')
    .insert({
      name,
      date,
      time,
      venue,
      city,
      description: description || null,
      status: status || 'draft',
      max_tickets_per_order: max_tickets_per_order ?? 10,
      organizer_phone: organizer_phone || null,
      location_link: req.body.location_link || null,
      terms_conditions: req.body.terms_conditions || null,
    })
    .select()
    .single();

  if (insertErr) {
    res.status(500).json(error('Failed to create event'));
    return;
  }

  res.status(201).json(success(event));
});

const updateEventValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 200 }),
  body('date').optional().trim().notEmpty(),
  body('time').optional().trim().notEmpty(),
  body('venue').optional().trim().isLength({ min: 1, max: 200 }),
  body('city').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isString(),
  body('status').optional().isIn(['draft', 'published', 'cancelled']),
  body('max_tickets_per_order').optional().isInt({ min: 1, max: 100 }),
  body('poster_url').optional().trim().isString(),
  body('banner_url').optional().trim().isString(),
  body('organizer_phone').optional().trim().isString(),
  body('location_link').optional().trim().isString(),
  body('terms_conditions').optional().trim().isString(),
];

router.put('/:event_id', updateEventValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { event_id } = req.params;
  const allowedFields = ['name', 'date', 'time', 'venue', 'city', 'description', 'status', 'max_tickets_per_order', 'poster_url', 'banner_url', 'organizer_phone', 'location_link', 'terms_conditions'];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json(error('No valid fields provided'));
    return;
  }

  const { data: event, error: updateErr } = await supabase
    .from('events')
    .update(updates)
    .eq('id', event_id)
    .select()
    .single();

  if (updateErr) {
    res.status(500).json(error('Failed to update event'));
    return;
  }

  res.json(success(event));
});

router.delete('/:event_id', async (req: Request, res: Response) => {
  const { event_id } = req.params;

  const { data: ticketTypes, error: ttErr } = await supabase
    .from('ticket_types')
    .select('id')
    .eq('event_id', event_id);

  if (ttErr) {
    res.status(500).json(error('Failed to check ticket types'));
    return;
  }

  if (ticketTypes && ticketTypes.length > 0) {
    const typeIds = ticketTypes.map((t) => t.id);

    const { data: activeOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('ticket_type_id', typeIds)
      .in('payment_status', ['receipt_uploaded', 'approved']);

    if (ordersErr) {
      res.status(500).json(error('Failed to check orders'));
      return;
    }

    if (activeOrders && activeOrders.length > 0) {
      res.status(400).json(error('Cannot delete event with pending or approved orders'));
      return;
    }
  }

  const { error: deleteErr } = await supabase
    .from('events')
    .delete()
    .eq('id', event_id);

  if (deleteErr) {
    res.status(500).json(error('Failed to delete event'));
    return;
  }

  res.json(success({ message: 'Event deleted' }));
});

const statusValidation = [
  body('status').isIn(['draft', 'published', 'cancelled']).withMessage('status must be draft, published, or cancelled'),
];

router.patch('/:event_id/status', statusValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { event_id } = req.params;
  const { status } = req.body;

  const { data: event, error: updateErr } = await supabase
    .from('events')
    .update({ status })
    .eq('id', event_id)
    .select()
    .single();

  if (updateErr) {
    res.status(500).json(error('Failed to update status'));
    return;
  }

  res.json(success(event));
});

// ── Banner upload ──

const bannerUploadLimiter = rateLimit({
  windowMs: MS.FIFTEEN_MINUTES,
  max: 10,
  message: { success: false, error: 'Too many upload attempts' }
});

router.post('/:event_id/banner', bannerUploadLimiter, upload.single('banner_image'), async (req: Request, res: Response) => {
  try {
    const { event_id } = req.params;
    const file = req.file;

    if (!file || file.size === 0) {
      res.status(400).json(error('Banner image is required'));
      return;
    }

    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime || (detectedMime !== 'image/jpeg' && detectedMime !== 'image/png')) {
      res.status(400).json(error('Invalid file type. Only JPG and PNG files are allowed'));
      return;
    }

    const ext = detectedMime === 'image/jpeg' ? 'jpg' : 'png';
    const storagePath = `${event_id}/${Date.now()}-banner.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('event-banners')
      .upload(storagePath, file.buffer, {
        contentType: detectedMime,
      });

    if (uploadErr) {
      console.error('Banner upload failed:', uploadErr.message || 'Unknown error');
      res.status(500).json(error('Failed to upload banner'));
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const banner_url = `${supabaseUrl}/storage/v1/object/public/event-banners/${storagePath}`;

    const { error: updateErr } = await supabase
      .from('events')
      .update({ banner_url })
      .eq('id', event_id);

    if (updateErr) {
      console.error('Failed to update banner_url:', updateErr.message || 'Unknown error');
      await supabase.storage.from('event-banners').remove([storagePath]);
      res.status(500).json(error('Failed to update event with banner URL'));
      return;
    }

    res.json(success({ banner_url }));
  } catch (err: unknown) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json(error('File too large. Maximum size is 5 MB.'));
      return;
    }
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json(error(message));
  }
});

// ── Ticket types CRUD ──

const ticketTypeValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('price').isInt({ min: 1 }).withMessage('price must be a positive integer (in paisas)'),
  body('total_quantity').isInt({ min: 1 }).withMessage('total_quantity must be a positive integer'),
  body('description').optional().trim().isString(),
  body('sort_order').optional().isInt(),
];

router.post('/:event_id/ticket-types', ticketTypeValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { event_id } = req.params;
  const { name, price, total_quantity, description, sort_order } = req.body;

  const { data: ticketType, error: insertErr } = await supabase
    .from('ticket_types')
    .insert({
      event_id,
      name,
      price,
      total_quantity,
      available_quantity: total_quantity,
      status: 'active',
      description: description || null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (insertErr) {
    res.status(500).json(error('Failed to create ticket type'));
    return;
  }

  res.status(201).json(success(ticketType));
});

const updateTicketTypeValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('price').optional().isInt({ min: 1 }),
  body('description').optional().trim().isString(),
  body('sort_order').optional().isInt(),
  body('status').optional().isIn(['active', 'inactive']),
];

router.put('/:event_id/ticket-types/:type_id', updateTicketTypeValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { type_id } = req.params;
  const allowedFields = ['name', 'price', 'description', 'sort_order', 'status'];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json(error('No valid fields provided'));
    return;
  }

  const { data: ticketType, error: updateErr } = await supabase
    .from('ticket_types')
    .update(updates)
    .eq('id', type_id)
    .select()
    .single();

  if (updateErr) {
    res.status(500).json(error('Failed to update ticket type'));
    return;
  }

  res.json(success(ticketType));
});

router.delete('/:event_id/ticket-types/:type_id', async (req: Request, res: Response) => {
  const { type_id } = req.params;

  const { data: activeOrders, error: ordersErr } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_type_id', type_id)
    .in('payment_status', ['receipt_uploaded', 'approved']);

  if (ordersErr) {
    res.status(500).json(error('Failed to check orders'));
    return;
  }

  if (activeOrders && activeOrders.length > 0) {
    res.status(400).json(error('Cannot delete ticket type with active orders'));
    return;
  }

  const { error: deleteErr } = await supabase
    .from('ticket_types')
    .delete()
    .eq('id', type_id);

  if (deleteErr) {
    res.status(500).json(error('Failed to delete ticket type'));
    return;
  }

  res.json(success({ message: 'Ticket type deleted' }));
});

const quantityValidation = [
  body('adjustment').isInt({ min: -999999 }).withMessage('adjustment must be an integer (positive or negative)'),
];

router.patch('/:event_id/ticket-types/:type_id/quantity', quantityValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
    return;
  }

  const { type_id } = req.params;
  const { adjustment } = req.body;

  const { data: ticketType, error: fetchErr } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('id', type_id)
    .single();

  if (fetchErr || !ticketType) {
    res.status(404).json(error('Ticket type not found'));
    return;
  }

  const newTotalQuantity = ticketType.total_quantity + adjustment;
  const newAvailableQuantity = ticketType.available_quantity + adjustment;

  if (newAvailableQuantity < 0) {
    res.status(400).json(error('Available quantity cannot go below 0'));
    return;
  }

  const { count: approvedCount, error: countErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('ticket_type_id', type_id)
    .in('payment_status', ['approved']);

  if (countErr) {
    res.status(500).json(error('Failed to count approved orders'));
    return;
  }

  if (newAvailableQuantity < (approvedCount ?? 0)) {
    res.status(400).json(error('Available quantity cannot go below number of approved orders'));
    return;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('ticket_types')
    .update({
      total_quantity: newTotalQuantity,
      available_quantity: newAvailableQuantity,
    })
    .eq('id', type_id)
    .select()
    .single();

  if (updateErr) {
    res.status(500).json(error('Failed to update quantity'));
    return;
  }

  res.json(success(updated));
});

export default router;
