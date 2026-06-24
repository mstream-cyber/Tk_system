ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('bank_transfer', 'easypaisa', 'cash'));

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
    'online_sales_count', COUNT(*) FILTER (WHERE payment_method != 'cash' AND payment_status = 'approved')::int,
    'gate_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'cash' AND payment_status = 'approved'), 0),
    'online_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method != 'cash' AND payment_status = 'approved'), 0)
  ) FROM orders;
$$;
