-- Backfill scan_token for orders created before the column existed

UPDATE orders
SET scan_token = 'gt_' || encode(gen_random_bytes(32), 'hex')
WHERE scan_token IS NULL;
