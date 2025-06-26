-- Check if passport_code column exists in students table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
ORDER BY ordinal_position;

-- Check a few students to see if they have passport codes
SELECT id, name, passport_code, created_at
FROM students
LIMIT 5;
