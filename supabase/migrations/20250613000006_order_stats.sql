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
    'total_revenue_approved', COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'approved'), 0)
  ) FROM orders;
$$;
