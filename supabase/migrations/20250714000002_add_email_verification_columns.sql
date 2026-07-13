-- Add missing email verification columns to orders table
-- These were defined in schema.sql but never created via migration

ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_code_sent_at TIMESTAMPTZ;
