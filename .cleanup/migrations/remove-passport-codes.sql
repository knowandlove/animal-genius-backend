-- Migration: Remove passport codes and finalize new auth system
-- Date: January 2025
-- Purpose: Complete transition from passport codes to funCode system

BEGIN;

-- Step 1: Verify students table has funCode column (should already exist from auth redesign)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'students' AND column_name = 'fun_code') THEN
        RAISE EXCEPTION 'Students table missing fun_code column. Run auth redesign migration first.';
    END IF;
END $$;

-- Step 2: Drop passport_code column from students table
ALTER TABLE students DROP COLUMN IF EXISTS passport_code;

-- Step 3: Drop passport_code column from classes table (replaced by session codes)
ALTER TABLE classes DROP COLUMN IF EXISTS passport_code;

-- Step 4: Remove any passport code indexes
DROP INDEX IF EXISTS idx_students_passport_code;
DROP INDEX IF EXISTS idx_classes_passport_code;

-- Step 5: Update quiz_submissions table - remove passport_code, link to student_id instead
ALTER TABLE quiz_submissions 
DROP COLUMN IF EXISTS passport_code,
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

-- Step 6: Create index for the new relationship
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student_id ON quiz_submissions(student_id);

-- Step 7: Drop the old passport code generation function
DROP FUNCTION IF EXISTS generate_passport_code();

-- Step 8: Add helpful comment
COMMENT ON TABLE students IS 'Students use funCode for authentication and avatarId for visual picker';
COMMENT ON TABLE classes IS 'Classes use sessionCode for classroom access (generated via API)';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Successfully removed passport code system and completed transition to funCode authentication';
END $$;

COMMIT; 