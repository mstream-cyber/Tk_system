-- Performance indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created_at ON orders (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON ticket_types (event_id);
CREATE INDEX IF NOT EXISTS idx_orders_ticket_type_id_payment_status ON orders (ticket_type_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- Fix public RLS on orders — restrict to service_role only
-- The server uses service_role key which bypasses RLS
DROP POLICY IF EXISTS "Orders readable by ticket_id" ON orders;
CREATE POLICY "Service role can read orders" ON orders
  FOR SELECT TO service_role USING (true);
