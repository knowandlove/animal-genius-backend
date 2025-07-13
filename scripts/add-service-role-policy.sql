-- Add service role access to tables (for Edge Functions)
-- This doesn't undo anything, just adds missing permissions

-- Add service role policy to classes
CREATE POLICY IF NOT EXISTS "Service role can access all classes" ON classes
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add service role policy to students  
CREATE POLICY IF NOT EXISTS "Service role can access all students" ON students
  FOR ALL
  USING (auth.role() = 'service_role');

-- Verify the policies exist
SELECT tablename, policyname 
FROM pg_policies
WHERE tablename IN ('classes', 'students')
AND policyname LIKE '%service role%';