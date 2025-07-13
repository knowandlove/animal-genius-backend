-- Check RLS status and policies
SELECT 
  schemaname,
  tablename, 
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename = 'classes';

-- List all policies on classes
SELECT 
  policyname as "Policy Name",
  permissive as "Type",
  cmd as "Command",
  roles as "Roles",
  qual as "Using Expression"
FROM pg_policies
WHERE tablename = 'classes'
ORDER BY policyname;

-- Test if we can select from classes in SQL Editor
SELECT COUNT(*) as class_count FROM classes;

-- Check our current role
SELECT current_user, auth.role();