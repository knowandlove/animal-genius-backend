-- Check if there's any data in the quiz_score column
SELECT COUNT(*) as count_with_score FROM students WHERE quiz_score IS NOT NULL;

-- If there is data, show a sample
SELECT id, student_name, quiz_score, created_at 
FROM students 
WHERE quiz_score IS NOT NULL 
LIMIT 10;