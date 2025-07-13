-- Clear test data before applying new migration
-- WARNING: This will delete all students and classes!

-- First, disable RLS temporarily to ensure we can delete
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;

-- Delete all students first (due to foreign key)
DELETE FROM students;

-- Delete all classes
DELETE FROM classes;

-- Re-enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Verify clean state
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM classes LIMIT 1) THEN
    RAISE EXCEPTION 'Failed to delete all classes';
  END IF;
  
  IF EXISTS (SELECT 1 FROM students LIMIT 1) THEN
    RAISE EXCEPTION 'Failed to delete all students';
  END IF;
  
  RAISE NOTICE 'Successfully cleared all test data!';
END $$;