-- Event management: new columns + service_role RLS policies

-- Events table additions
ALTER TABLE events ADD COLUMN IF NOT EXISTS
  status TEXT DEFAULT 'draft'
  CHECK (status IN ('draft', 'published', 'cancelled'));

ALTER TABLE events ADD COLUMN IF NOT EXISTS
  description TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS
  banner_url TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS
  time TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS
  max_tickets_per_order INTEGER DEFAULT 10;

-- Ticket types table additions
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS
  description TEXT;

ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS
  status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'paused', 'sold_out'));

ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS
  sort_order INTEGER DEFAULT 0;

-- NOTE: Create a storage bucket named 'event-banners'
-- in Supabase dashboard. Set it to PUBLIC (banners are
-- displayed on the booking page).

-- RLS: service_role INSERT, UPDATE, DELETE on events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Service role can insert events'
  ) THEN
    CREATE POLICY "Service role can insert events" ON events
      FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Service role can update events'
  ) THEN
    CREATE POLICY "Service role can update events" ON events
      FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Service role can delete events'
  ) THEN
    CREATE POLICY "Service role can delete events" ON events
      FOR DELETE TO service_role USING (true);
  END IF;
END
$$;

-- RLS: service_role INSERT, DELETE on ticket_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ticket_types' AND policyname = 'Service role can insert ticket_types'
  ) THEN
    CREATE POLICY "Service role can insert ticket_types" ON ticket_types
      FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ticket_types' AND policyname = 'Service role can delete ticket_types'
  ) THEN
    CREATE POLICY "Service role can delete ticket_types" ON ticket_types
      FOR DELETE TO service_role USING (true);
  END IF;
END
$$;
