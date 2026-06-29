import { Router, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';
import { FILE, MS } from '../lib/constants';

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: MS.FIFTEEN_MINUTES,
  max: 3,
  message: { success: false, error: 'Too many upload attempts' },
});

const ALLOWED_TYPES = FILE.ALLOWED_RECEIPT_TYPES;
const MAX_SIZE = FILE.MAX_UPLOAD_SIZE;

function detectMime(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or PDF files are allowed'));
    }
  },
});

router.post(
  '/upload-receipt',
  uploadLimiter,
  upload.single('receipt_image'),
  async (req: Request, res: Response) => {
    try {
      const { order_id } = req.body;
      const file = req.file;

      if (!order_id) {
        res.status(400).json(error('order_id is required'));
        return;
      }

      if (!file || file.size === 0) {
        res.status(400).json(error('Receipt file is empty or missing'));
        return;
      }

      // Verify MIME via magic bytes
      const detectedMime = detectMime(file.buffer);
      if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
        res.status(400).json(error('Invalid file type. Only JPG, PNG, or PDF files are allowed'));
        return;
      }

      const { data: order, error: findErr } = await supabase
        .from('orders')
        .select('id, payment_status')
        .eq('id', order_id)
        .single();

      if (findErr || !order) {
        res.status(404).json(error('Order not found'));
        return;
      }

      if (order.payment_status !== 'pending') {
        res.status(400).json(error('Receipt already submitted for this order'));
        return;
      }

      const ext = detectedMime === 'image/jpeg' ? 'jpg' : detectedMime === 'image/png' ? 'png' : 'pdf';
      const storagePath = `receipts/${order_id}/${Date.now()}-receipt.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('payment-receipts')
        .upload(storagePath, file.buffer, {
        contentType: detectedMime,
      });

      if (uploadErr) {
        console.error('Storage upload failed:', uploadErr.message || 'Unknown error');
        res.status(500).json(error('Receipt upload failed. Please try again.'));
        return;
      }

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          receipt_url: storagePath,
          receipt_uploaded_at: new Date().toISOString(),
          payment_status: 'receipt_uploaded',
        })
        .eq('id', order_id);

      if (updateErr) {
        console.error('Failed to update order:', updateErr.message || 'Unknown error');
        await supabase.storage.from('payment-receipts').remove([storagePath]);
        res.status(500).json(error('Receipt upload failed. Please try again.'));
        return;
      }

      res.status(200).json(success({ message: 'Receipt uploaded. You will be notified via email.' }));
    } catch (err: unknown) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json(error('File too large. Maximum size is 5 MB.'));
        return;
      }
      const message = err instanceof Error ? err.message : 'Upload failed';
      res.status(400).json(error(message));
    }
  }
);

router.get('/order/:order_id/status', async (req: Request, res: Response) => {
  const { order_id } = req.params;
  const email = req.query.email as string | undefined;

  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select('payment_status, ticket_id, buyer_email, email_verified')
    .eq('id', order_id)
    .single();

  if (findErr || !order) {
    res.status(404).json(error('Order not found'));
    return;
  }

  if (!order.email_verified) {
    res.json(success({ payment_status: order.payment_status, email_verified: false }));
    return;
  }

  if (email && order.buyer_email !== email) {
    res.status(403).json(error('Email does not match order'));
    return;
  }

  res.json(
    success({
      payment_status: order.payment_status,
      ticket_id: order.payment_status === 'approved' ? order.ticket_id : null,
      email_verified: true,
    })
  );
});

export default router;
