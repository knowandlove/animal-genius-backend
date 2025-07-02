-- Add unique constraint on (classId, studentName) to students table
ALTER TABLE students 
ADD CONSTRAINT unique_class_student 
UNIQUE (class_id, student_name);

-- Verify the constraint was added
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'students'::regclass
AND conname = 'unique_class_student';