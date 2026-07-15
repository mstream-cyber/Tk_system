ALTER TABLE events
  ADD COLUMN bulk_discount_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN bulk_discount_min_qty INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN bulk_discount_type TEXT NOT NULL DEFAULT 'percentage',
  ADD COLUMN bulk_discount_value INTEGER NOT NULL DEFAULT 0;
