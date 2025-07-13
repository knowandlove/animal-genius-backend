-- Add service role access to tables (for Edge Functions)

-- First check if policies already exist
SELECT tablename, policyname 
FROM pg_policies
WHERE tablename IN ('classes', 'students')
ORDER BY tablename, policyname;

-- Add service role policies (drop first if they exist)
DROP POLICY IF EXISTS "Service role can access all classes" ON classes;
CREATE POLICY "Service role can access all classes" ON classes
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can access all students" ON students;
CREATE POLICY "Service role can access all students" ON students
  FOR ALL
  USING (auth.role() = 'service_role');

-- Verify they were created
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename IN ('classes', 'students')
AND policyname LIKE '%Service role%';