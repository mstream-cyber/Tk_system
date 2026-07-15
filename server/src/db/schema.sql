-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================
-- EVENTS
-- ============================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  poster_url TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'cancelled')),
  description TEXT,
  banner_url TEXT,
  time TEXT,
  max_tickets_per_order INTEGER DEFAULT 10,
  bulk_discount_enabled BOOLEAN NOT NULL DEFAULT false,
  bulk_discount_min_qty INTEGER NOT NULL DEFAULT 5,
  bulk_discount_type TEXT NOT NULL DEFAULT 'percentage',
  bulk_discount_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================
-- TICKET TYPES
-- ============================
CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  total_quantity INTEGER NOT NULL,
  available_quantity INTEGER NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'sold_out')),
  sort_order INTEGER DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================
-- ORDERS
-- ============================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID REFERENCES ticket_types(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_city TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount INTEGER NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'easypaisa', 'pay_on_gate', 'invite')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'receipt_uploaded', 'approved', 'rejected')),
  receipt_url TEXT,
  receipt_uploaded_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  paid BOOLEAN DEFAULT true,
  paid_at TIMESTAMPTZ,
  scanned_at TIMESTAMPTZ,
  ticket_id TEXT UNIQUE NOT NULL,
  scan_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  email_verified BOOLEAN DEFAULT false,
  verification_code_hash TEXT,
  verification_attempts INTEGER DEFAULT 0,
  verification_code_sent_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_scan_token ON orders (scan_token);
CREATE INDEX idx_orders_email_verified ON orders (ticket_id, email_verified);

-- ============================
-- WAITLIST
-- ============================
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, email)
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert waitlist" ON waitlist
  FOR INSERT
  TO public
  WITH CHECK (true);

-- ============================
-- EMAIL VERIFICATIONS
-- ============================
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT now(),
  verified BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications (email);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage email verifications" ON email_verifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================
-- ROW LEVEL SECURITY
-- ============================

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read events" ON events
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can insert events" ON events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update events" ON events
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete events" ON events
  FOR DELETE TO service_role USING (true);

-- Ticket types
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ticket_types" ON ticket_types
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can insert ticket_types" ON ticket_types
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update ticket_types" ON ticket_types
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete ticket_types" ON ticket_types
  FOR DELETE TO service_role USING (true);

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert orders" ON orders
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Service role can read orders" ON orders
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update orders" ON orders
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can read orders by scan_token" ON orders
  FOR SELECT
  TO service_role
  USING (true);
