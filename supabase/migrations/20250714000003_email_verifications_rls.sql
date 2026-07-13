-- Enable RLS on email_verifications table
-- Server uses service_role key which bypasses RLS, but direct DB access is restricted

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage email verifications" ON email_verifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);
