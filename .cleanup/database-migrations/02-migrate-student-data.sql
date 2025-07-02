-- Phase 2: Migrate existing student data
-- Run this AFTER creating the students table

-- Step 1: Insert unique students from quiz_submissions
-- This is safe to run multiple times - it won't create duplicates
INSERT INTO public.students (passport_code, display_name, class_id, wallet_balance, created_at)
SELECT DISTINCT ON (passport_code)
    passport_code,
    student_name AS display_name,
    class_id,
    currency_balance AS wallet_balance,
    MIN(completed_at) AS created_at
FROM public.quiz_submissions
WHERE passport_code IS NOT NULL
GROUP BY passport_code, student_name, class_id, currency_balance
ON CONFLICT (passport_code) DO NOTHING;

-- Step 2: Update quiz_submissions to link to the new students table
UPDATE public.quiz_submissions qs
SET student_id = s.id
FROM public.students s
WHERE qs.passport_code = s.passport_code
AND qs.student_id IS NULL;

-- Step 3: Verify the migration
SELECT 
    COUNT(*) as total_submissions,
    COUNT(student_id) as linked_submissions,
    COUNT(*) - COUNT(student_id) as unlinked_submissions
FROM public.quiz_submissions;
