-- Check current security status (PostgreSQL 12+ compatible)

-- 1. Check if passport_code has UNIQUE constraint
SELECT 
  indexname, 
  indexdef,
  CASE WHEN indexdef LIKE '%UNIQUE%' THEN 'YES' ELSE 'NO' END as is_unique
FROM pg_indexes 
WHERE tablename = 'students' 
AND indexname LIKE '%passport%';

-- 2. Check if generate_passport_code has the weak fallback
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%MD5(RANDOM()%' THEN 'HAS WEAK FALLBACK - NEEDS FIX'
    WHEN prosrc LIKE '%RAISE EXCEPTION%' THEN 'GOOD - Fails properly'
    ELSE 'UNKNOWN - Check manually'
  END as fallback_status
FROM pg_proc 
WHERE proname = 'generate_passport_code';

-- 3. Check if functions have search_path set
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as config_settings
FROM pg_proc 
WHERE proname IN ('submit_quiz_atomic', 'validate_student_login', 'calculate_animal_type');

-- 4. Check if passport format constraint exists
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid, true) as check_definition
FROM pg_constraint 
WHERE conrelid = 'students'::regclass 
AND conname LIKE '%passport%';

-- 5. Check if uppercase trigger exists
SELECT 
  tgname as trigger_name,
  tgtype as trigger_type,
  tgisinternal as is_internal
FROM pg_trigger 
WHERE tgrelid = 'students'::regclass 
AND tgname LIKE '%passport%';