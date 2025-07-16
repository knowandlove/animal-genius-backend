-- Check database statistics

-- Profiles table
\echo '=== PROFILES TABLE ==='
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
  COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
FROM profiles;

\echo '\nAll profiles:'
SELECT id, email, full_name, role, created_at
FROM profiles
ORDER BY created_at DESC;

-- Auth users table
\echo '\n=== AUTH.USERS TABLE ==='
SELECT COUNT(*) as total_users
FROM auth.users;

\echo '\nAuth users:'
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- Classes table
\echo '\n=== CLASSES TABLE ==='
SELECT 
  COUNT(*) as total_classes,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_classes,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_classes
FROM classes;

\echo '\nAll classes with teacher info:'
SELECT 
  c.id,
  c.class_name,
  c.class_code,
  c.is_active,
  c.created_at,
  p.email as teacher_email,
  p.full_name as teacher_name
FROM classes c
LEFT JOIN profiles p ON c.teacher_id = p.id
ORDER BY c.created_at DESC;

-- Students table
\echo '\n=== STUDENTS TABLE ==='
SELECT COUNT(*) as total_students
FROM students;

-- Data integrity checks
\echo '\n=== DATA INTEGRITY CHECKS ==='

\echo '\nProfiles without auth.users:'
SELECT p.id, p.email, p.role
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;

\echo '\nDuplicate emails in profiles:'
SELECT email, COUNT(*) as count
FROM profiles
GROUP BY email
HAVING COUNT(*) > 1;

\echo '\nAnonymous auth users:'
SELECT COUNT(*) as count
FROM auth.users
WHERE email LIKE '%@anonymous.local';