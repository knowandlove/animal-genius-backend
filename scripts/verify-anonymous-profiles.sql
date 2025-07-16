-- Script to verify anonymous profiles in the database

-- 1. Count profiles by type
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN is_anonymous = true THEN 1 END) as anonymous_profiles,
  COUNT(CASE WHEN is_anonymous = false OR is_anonymous IS NULL THEN 1 END) as teacher_profiles
FROM profiles;

-- 2. List all non-anonymous profiles (teachers)
SELECT 
  id,
  email,
  full_name,
  is_admin,
  created_at,
  last_login_at
FROM profiles
WHERE is_anonymous = false OR is_anonymous IS NULL
ORDER BY created_at DESC;

-- 3. Check for any profiles that might be missing the is_anonymous flag
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.is_anonymous,
  CASE 
    WHEN p.email LIKE '%@anonymous.local' THEN 'Should be anonymous'
    ELSE 'Should be teacher'
  END as expected_type
FROM profiles p
WHERE 
  (p.email LIKE '%@anonymous.local' AND (p.is_anonymous = false OR p.is_anonymous IS NULL))
  OR 
  (p.email NOT LIKE '%@anonymous.local' AND p.is_anonymous = true);

-- 4. Fix any profiles with incorrect is_anonymous flag
-- UNCOMMENT TO RUN:
-- UPDATE profiles
-- SET is_anonymous = true
-- WHERE email LIKE '%@anonymous.local' AND (is_anonymous = false OR is_anonymous IS NULL);

-- UPDATE profiles  
-- SET is_anonymous = false
-- WHERE email NOT LIKE '%@anonymous.local' AND is_anonymous = true;