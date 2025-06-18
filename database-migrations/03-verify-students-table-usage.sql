-- Run this in Supabase SQL Editor to check if new students are being created

-- Check the last 5 students created
SELECT 
    s.id,
    s.display_name,
    s.passport_code,
    s.wallet_balance,
    s.created_at,
    c.name as class_name
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
ORDER BY s.created_at DESC
LIMIT 5;

-- Check if new quiz submissions are linking to students
SELECT 
    qs.id,
    qs.student_name,
    qs.passport_code,
    qs.student_id,
    qs.completed_at
FROM quiz_submissions qs
WHERE qs.student_id IS NOT NULL
ORDER BY qs.completed_at DESC
LIMIT 5;
