-- Clean start for classes table
-- WARNING: This will DELETE all existing classes and their students!

-- First, delete all students (due to foreign key constraint)
DELETE FROM students;

-- Then delete all classes
DELETE FROM classes;

-- Reset any sequences if needed
-- (Classes likely uses UUID so no sequence to reset)

-- Verify clean state
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM classes LIMIT 1) THEN
    RAISE EXCEPTION 'Failed to delete all classes';
  END IF;
  
  IF EXISTS (SELECT 1 FROM students LIMIT 1) THEN
    RAISE EXCEPTION 'Failed to delete all students';
  END IF;
  
  RAISE NOTICE 'Successfully cleared all classes and students. Ready for fresh start!';
END $$;