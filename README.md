# Global Tickets

A concert ticket booking platform with manual payment approval flow. Built with React + TypeScript + TailwindCSS frontend and Express + TypeScript backend on Supabase.

## How It Works

1. **Browse & Book** — User selects a ticket type, fills in details, chooses Bank Transfer or EasyPaisa
2. **Pay & Upload** — User transfers the exact amount and uploads a payment receipt (JPG/PNG/PDF)
3. **Admin Review** — Admin logs into the dashboard, views receipts, approves or rejects
4. **Ticket Delivery** — On approval, a PDF ticket with QR code is emailed to the buyer

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- SMTP credentials (Mailtrap for testing, any SMTP for production)

## Local Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd global-tickets
cd server && npm install && cd ../client && npm install && cd ..

# 2. Configure environment
cp .env.example server/.env
# Edit server/.env with your Supabase URL, keys, and SMTP credentials

# 3. Set up database
cd server
npm run db:setup   # Links Supabase project and runs migrations
cd ..

# 4. Start development servers
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev

# Open http://localhost:5173
```

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (server-side) |
| `ADMIN_PASSWORD` | Password for admin dashboard login |
| `JWT_SECRET` | Secret for signing admin JWT tokens |
| `CLIENT_ORIGIN` | CORS origin (e.g. http://localhost:5173) |
| `CLIENT_URL` | Frontend URL for email links |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From email address |
| `BANK_NAME` | Bank name displayed on payment page |
| `BANK_ACCOUNT_TITLE` | Bank account title |
| `BANK_ACCOUNT_NUMBER` | Bank account number |
| `BANK_IBAN` | Bank IBAN |
| `EASYPAISA_NUMBER` | EasyPaisa account number |
| `EASYPAISA_TITLE` | EasyPaisa account title |
| `CONTACT_WHATSAPP` | WhatsApp number for support |

## Manual Payment Approval Flow

1. User submits the booking form on the home page
2. On Step 2, they choose **Bank Transfer** or **EasyPaisa** with account details shown
3. They transfer the exact amount and upload the receipt image/PDF
4. The receipt is uploaded to Supabase Storage (private bucket `payment-receipts`)
5. The order is created with `payment_status = 'pending'`, then updated to `receipt_uploaded`
6. User sees a pending confirmation screen with their booking reference

## Admin Dashboard

**URL:** `/admin/login`
**Password:** Set via `ADMIN_PASSWORD` env var

### Features

- **Stats cards** — Total bookings, awaiting review, approved, rejected, revenue
- **Orders table** — All orders with search, status filter, ticket type filter
- **Receipt review** — Click "View receipt" to open the uploaded receipt in a new tab
- **Approve** — Confirms payment, sends ticket PDF email to buyer, links to `/ticket/:id`
- **Reject** — Shows inline reason input, sends rejection email with reason and WhatsApp contact
- **Resend ticket** — Re-sends the ticket email for approved orders
- **Export CSV** — Downloads all orders as a CSV file

### How to Approve/Reject

1. Log in at `/admin/login`
2. Orders needing review show "Awaiting review" (amber badge)
3. Click **View receipt** to see the payment proof
4. If valid: Click **Approve** → confirm dialog → ticket email is sent automatically
5. If invalid: Click **Reject** → type reason → confirmation sends rejection email

## Known Architecture Notes

- **Payment account details** (bank, EasyPaisa) are configured via environment variables, not hardcoded. Update `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_IBAN`, `EASYPAISA_NUMBER` in your `.env` to change them without redeployment.
- **QR scanner** at `/scan` requires `VITE_SCAN_PIN` to be set in the client environment. Default is `0000`. Change this before going live.
- **Storage bucket** `payment-receipts` must be created manually in the Supabase dashboard (Storage → New bucket → name: `payment-receipts` → set to private). The SQL migration cannot create it automatically.
- **Scan PIN security model** — `VITE_SCAN_PIN` is embedded in the compiled JavaScript bundle at build time and is visible in browser DevTools. It is not server-enforced — it is a convenience barrier only. Change it from the default `0000` before going live and treat it as a staff convenience feature, not a security control. The admin dashboard PIN modal uses the same value.

## Database Schema

**Tables:**
- `events` — Event name, date, venue, city
- `ticket_types` — Name, price, quantities (linked to events)
- `orders` — Buyer info, payment status, receipt URL, approval timestamps
- `waitlist` — Email capture for sold-out events

**Storage:**
- `payment-receipts` (private bucket) — Receipt files organized as `receipts/{order_id}/{timestamp}-receipt.{ext}`

## API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/api/events` | List events with ticket types |
| GET | `/api/config` | Payment account details (from env vars) |
| GET | `/api/health` | Health check (DB + Storage status) |
| POST | `/api/book` | Create a booking order |
| GET | `/api/ticket/:id` | Get ticket/order by ticket ID |
| POST | `/api/payment/upload-receipt` | Upload payment receipt |
| GET | `/api/payment/order/:id/status` | Check order payment status |
| POST | `/api/waitlist` | Join waitlist for sold-out events |

### Admin (JWT required)
| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/login` | Login with password, returns JWT |
| GET | `/api/admin/orders` | List orders with filters |
| GET | `/api/admin/orders/:id/receipt` | Signed receipt URL (60 min) |
| POST | `/api/admin/orders/:id/approve` | Approve order + send ticket |
| POST | `/api/admin/orders/:id/reject` | Reject order + send notification |
| GET | `/api/admin/stats` | Aggregated order statistics |
| POST | `/api/admin/resend/:id` | Re-send ticket email |
| GET | `/api/admin/export` | Download orders CSV |

## Deployment

The project is configured for **Vercel** deployment (frontend + serverless API).

### Vercel Setup

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set all env vars from `.env.example` in Vercel project settings
4. Set build command to `cd client && npm install && npm run build`
5. Output directory: `client/dist`
6. Deploy — Vercel auto-detects `vercel.json` for API rewrites

### Required Vercel Environment Variables

All vars from `.env.example` must be set in the Vercel dashboard, especially:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`, `JWT_SECRET`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
- `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `EASYPAISA_NUMBER`, `CONTACT_WHATSAPP`
- `CLIENT_URL` — set to your Vercel domain (e.g. `https://global-tickets.vercel.app`)

### Project Structure

```
/
├── api/index.ts            # Vercel serverless entry point
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # TicketCard, ErrorBoundary
│   │   ├── pages/          # BookingPage, AdminLogin, AdminDashboard, TicketPage, NotFound
│   │   ├── utils/          # format, downloadTicket
│   │   ├── api.ts          # API client functions
│   │   └── types.ts        # TypeScript interfaces
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # events, ticket, booking, receipt, admin, waitlist
│   │   ├── middleware/     # auth (JWT), errorHandler
│   │   ├── services/       # email (ticket PDF, QR, SMTP)
│   │   ├── utils/          # response helpers, ticket ID generator
│   │   ├── app.ts          # Express app setup (no listen)
│   │   ├── index.ts        # Local dev entry (app.listen)
│   │   └── supabase.ts     # Supabase client singleton
│   └── package.json
├── supabase/
│   └── migrations/         # Database migration files
├── vercel.json
├── package.json            # Root (deps for Vercel)
├── .env.example
└── README.md
```
