-- Fix total_revenue_approved to exclude unpaid pay_on_gate orders
-- Add invite_revenue and pay_on_gate_revenue fields

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
    'total_revenue_approved', COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'approved' AND (payment_method != 'pay_on_gate' OR paid = true)), 0),
    'gate_sales_count', COUNT(*) FILTER (WHERE payment_method = 'cash' AND payment_status = 'approved')::int,
    'online_sales_count', COUNT(*) FILTER (WHERE payment_method NOT IN ('cash', 'pay_on_gate', 'invite') AND payment_status = 'approved')::int,
    'pay_on_gate_count', COUNT(*) FILTER (WHERE payment_method = 'pay_on_gate' AND payment_status = 'approved')::int,
    'unpaid_count', COUNT(*) FILTER (WHERE payment_method = 'pay_on_gate' AND payment_status = 'approved' AND paid = false)::int,
    'invite_count', COUNT(*) FILTER (WHERE payment_method = 'invite' AND payment_status = 'approved')::int,
    'gate_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'cash' AND payment_status = 'approved'), 0),
    'online_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method NOT IN ('cash', 'pay_on_gate', 'invite') AND payment_status = 'approved'), 0),
    'invite_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'invite' AND payment_status = 'approved'), 0),
    'pay_on_gate_revenue', COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'pay_on_gate' AND payment_status = 'approved' AND paid = true), 0)
  ) FROM orders;
$$;
