-- Add scan_token column for secure QR codes

ALTER TABLE orders ADD COLUMN IF NOT EXISTS scan_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_scan_token ON orders (scan_token);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Service role can read orders by scan_token'
  ) THEN
    CREATE POLICY "Service role can read orders by scan_token"
      ON orders FOR SELECT TO service_role USING (true);
  END IF;
END
$$;
