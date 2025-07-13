-- Fix RLS policies to allow Edge Functions to read classes

-- First, check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('classes', 'students', 'profiles');

-- Drop existing policies on classes (if any)
DROP POLICY IF EXISTS "Students can read their class" ON classes;
DROP POLICY IF EXISTS "Teachers can read their classes" ON classes;

-- Create new policies that allow service role AND authenticated users
CREATE POLICY "Service role can do anything" ON classes
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read classes" ON classes
  FOR SELECT
  USING (true);  -- Allow all authenticated users to read classes (for checking eligibility)

CREATE POLICY "Teachers can manage their classes" ON classes
  FOR ALL
  USING (auth.uid() = teacher_id);

-- Also ensure students table has proper policies
DROP POLICY IF EXISTS "Students can read own data" ON students;
DROP POLICY IF EXISTS "Anonymous can submit quiz" ON students;

CREATE POLICY "Service role full access" ON students
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Students can read own data" ON students
  FOR SELECT
  USING (auth.uid() = user_id);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('classes', 'students')
ORDER BY tablename, policyname;