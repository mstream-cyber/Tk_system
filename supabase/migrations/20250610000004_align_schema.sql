-- Align remote schema with current migration 001 after in-place edits

-- 1. Add missing columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

-- 2. Drop stale column (no code references it)
ALTER TABLE orders DROP COLUMN IF EXISTS payment_reference;

-- 3. Ensure CHECK constraints are correct (idempotent)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('bank_transfer', 'easypaisa'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'receipt_uploaded', 'approved', 'rejected'));

-- 4. Enable RLS on events + public SELECT policy
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Anyone can read events'
  ) THEN
    CREATE POLICY "Anyone can read events" ON events FOR SELECT TO public USING (true);
  END IF;
END
$$;

-- 5. Enable RLS on ticket_types + public SELECT policy
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ticket_types' AND policyname = 'Anyone can read ticket_types'
  ) THEN
    CREATE POLICY "Anyone can read ticket_types" ON ticket_types FOR SELECT TO public USING (true);
  END IF;
END
$$;

-- 6. Add service_role UPDATE policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Service role can update orders'
  ) THEN
    CREATE POLICY "Service role can update orders" ON orders
      FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ticket_types' AND policyname = 'Service role can update ticket_types'
  ) THEN
    CREATE POLICY "Service role can update ticket_types" ON ticket_types
      FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;
