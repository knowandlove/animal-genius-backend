-- Clean up all test student data
-- Run this BEFORE applying the avatar migration

-- 1. Delete all student-related data (CASCADE handles dependencies)
TRUNCATE TABLE public.currency_transactions CASCADE;
TRUNCATE TABLE public.quiz_submissions CASCADE;
TRUNCATE TABLE public.student_inventory CASCADE;
TRUNCATE TABLE public.students CASCADE;

-- 2. Reset student counts in all classes to 0
UPDATE public.classes SET student_count = 0;

-- 3. Show what's left
SELECT 'Classes remaining:' as info, COUNT(*) as count FROM public.classes
UNION ALL
SELECT 'Students remaining:', COUNT(*) FROM public.students;