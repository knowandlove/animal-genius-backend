-- Verify Security Fixes Applied Successfully

-- 1. Check UNIQUE constraint on passport_code
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'students' 
AND indexname = 'idx_students_passport_code';

-- 2. Check format constraint on passport_code
SELECT 
    conname,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'students'::regclass
AND conname = 'chk_passport_code_format';

-- 3. Check trigger exists
SELECT 
    tgname,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'students'::regclass
AND tgname = 'trg_uppercase_passport_code';

-- 4. Check SECURITY DEFINER with search_path
SELECT 
    proname,
    prosecdef as is_security_definer,
    proconfig
FROM pg_proc
WHERE proname IN ('submit_quiz_atomic', 'validate_student_login', 'generate_passport_code')
ORDER BY proname;

-- 5. Test passport code generation (should fail after 50 attempts if all codes exist)
-- This just shows the function signature
SELECT 
    proname,
    pg_get_function_arguments(oid) as arguments,
    pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname = 'generate_passport_code';

-- 6. Count existing students (to see if any have duplicate passport codes)
SELECT 
    COUNT(*) as total_students,
    COUNT(DISTINCT passport_code) as unique_passport_codes,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT passport_code) 
        THEN 'No duplicates ✓'
        ELSE 'DUPLICATES FOUND! ✗'
    END as status
FROM students;