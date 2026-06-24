import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import { errorHandler } from './middleware/errorHandler';
import { MS } from './lib/constants';
import eventsRouter from './routes/events';
import ticketRouter from './routes/ticket';
import bookingRouter from './routes/booking';
import receiptRouter from './routes/receipt';
import adminRouter from './routes/admin';
import adminEventsRouter from './routes/adminEvents';
import waitlistRouter from './routes/waitlist';
import { supabase } from './supabase';
import { success } from './utils/response';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(helmet());

app.use((req, res, next) => {
  res.locals.requestId = uuidv4();
  next();
});

morgan.token('reqid', (_req, res) => (res as Response).locals.requestId || '-');
app.use(morgan(':reqid :method :url :status :response-time ms'));
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// GET /api/config — public payment details
app.get('/api/config', (_req, res) => {
  res.json(success({
    bank_name: process.env.BANK_NAME || 'Meezan Bank',
    bank_account_title: process.env.BANK_ACCOUNT_TITLE || 'Global Tickets Pvt Ltd',
    bank_account_number: process.env.BANK_ACCOUNT_NUMBER || '0123-0123456789',
    bank_iban: process.env.BANK_IBAN || 'PK00MEZN0001234567890',
    easypaisa_number: process.env.EASYPAISA_NUMBER || '0300-0000000',
    easypaisa_title: process.env.EASYPAISA_TITLE || 'Global Tickets',
    contact_whatsapp: process.env.CONTACT_WHATSAPP || '+923000000000',
  }));
});

// GET /api/health
app.get('/api/health', async (_req, res) => {
  let db = 'disconnected';
  let storage = 'disconnected';
  try {
    const { error: dbErr } = await supabase.from('events').select('id', { count: 'exact', head: true });
    db = dbErr ? 'disconnected' : 'connected';
  } catch (err) { console.error('Health check DB failed:', err); db = 'error'; }
  try {
    const { error: storageErr } = await supabase.storage.from('payment-receipts').list('', { limit: 1 });
    storage = storageErr ? 'disconnected' : 'connected';
  } catch (err) { console.error('Health check storage failed:', err); storage = 'error'; }
  res.json({ status: 'ok', timestamp: new Date().toISOString(), db, storage });
});

// Rate limiters
const bookLimiter = rateLimit({ windowMs: MS.FIFTEEN_MINUTES, max: 5, message: { success: false, error: 'Too many booking attempts' } });
const uploadLimiter = rateLimit({ windowMs: MS.FIFTEEN_MINUTES, max: 3, message: { success: false, error: 'Too many upload attempts' } });

app.use('/api/events', eventsRouter);
app.use('/api/ticket', ticketRouter);
app.use('/api/book', bookLimiter, bookingRouter);
app.use('/api/payment', uploadLimiter, receiptRouter);
app.use('/api/waitlist', waitlistRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/events', adminEventsRouter);

if (!process.env.VERCEL) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
