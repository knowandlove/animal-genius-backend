-- Check current user and role
SELECT current_user, current_role;

-- Check if service role policy exists and is working
SELECT auth.role();

-- Try to select from classes as current user
SELECT COUNT(*) as class_count FROM classes;

-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'classes';

-- List ALL policies on classes table
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'classes';