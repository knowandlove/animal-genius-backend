-- Add unique constraint on (class_id, student_name) to prevent duplicate students in a class
-- This supports atomic upsert operations and prevents race conditions

-- First, check for and handle any existing duplicates
WITH duplicates AS (
  SELECT 
    class_id,
    student_name,
    COUNT(*) as count,
    MIN(created_at) as first_created
  FROM students
  WHERE student_name IS NOT NULL
  GROUP BY class_id, student_name
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- If duplicates exist, they should be manually reviewed and merged
-- For now, we'll add the constraint only if no duplicates exist

DO $$
BEGIN
  -- Check if any duplicates exist
  IF NOT EXISTS (
    SELECT 1
    FROM students s1
    JOIN students s2 ON s1.class_id = s2.class_id 
      AND s1.student_name = s2.student_name
      AND s1.id != s2.id
    WHERE s1.student_name IS NOT NULL
  ) THEN
    -- Create the unique index
    CREATE UNIQUE INDEX IF NOT EXISTS unique_class_student 
    ON students(class_id, student_name) 
    WHERE student_name IS NOT NULL;
    
    RAISE NOTICE 'Unique constraint added successfully';
  ELSE
    RAISE WARNING 'Duplicate students found in same class. Please resolve duplicates before adding constraint.';
  END IF;
END $$;