-- Add color column to ticket_types for auto-assigned colors
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS color TEXT;

-- Add 'invite' to payment_method check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('bank_transfer', 'easypaisa', 'cash', 'pay_on_gate', 'invite'));

-- Update stats RPC to include invite count
CREATE OR REPLACE FUNCTION get_order_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_orders', COUNT(*)::int,
    'pending_count', COUNT(*) FILTER (WHERE payment_status = 'pending')::int,
    'receipt_uploaded_count', COUNT(*) FILTER (WHERE payment_status = 'receipt_uploaded')::int,
    'approved_count', COUNT(*) FILTER (WHERE payment_status = 'approved')::int,
    'rejected_count', COUNT(*) FILTER (WHERE payment_status = 'rejected')::int,
    'total_revenue_approved', COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'approved'), 0),
    'gate_sales_count', COUNT(*) FILTER (WHERE payment_method = 'cash' AND payment_status = 'approved')::int,
    'online_sales_count', COUNT(*) FILTER (WHERE payment_method NOT IN ('cash', 'pay_on_gate', 'invite') AND payment_status = 'approved')::int,
    'pay_on_gate_count', COUNT(*) FILTER (WHERE payment_method = 'pay_on_gate' AND payment_status = 'approved')::int,
    'unpaid_count', COUNT(*) FILTER (WHERE payment_method = 'pay_on_gate' AND payment_status = 'approved' AND paid = false)::int,
    'invite_count', COUNT(*) FILTER (WHERE payment_method = 'invite' AND payment_status = 'approved')::int,
    'gate_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'cash' AND payment_status = 'approved'), 0),
    'online_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method NOT IN ('cash', 'pay_on_gate', 'invite') AND payment_status = 'approved'), 0)
  ) FROM orders;
$$;
