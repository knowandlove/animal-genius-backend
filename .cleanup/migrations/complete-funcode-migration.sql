-- Complete the funCode migration
-- This migration updates the database to use funCode instead of passportCode

-- 1. Add funcode column to classes table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'funcode') THEN
        ALTER TABLE classes ADD COLUMN funcode VARCHAR(20) UNIQUE;
    END IF;
END $$;

-- 2. Add funcode column to students table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'funcode') THEN
        ALTER TABLE students ADD COLUMN funcode VARCHAR(20) UNIQUE;
    END IF;
END $$;

-- 3. Generate funCodes for existing classes that don't have them
UPDATE classes 
SET funcode = CONCAT(
    (ARRAY['HAPPY', 'BRAVE', 'SMART', 'FUNNY', 'QUICK', 'WISE', 'FRIENDLY', 'CLEVER', 'BRIGHT', 'JOLLY'])[floor(random() * 10 + 1)],
    '-',
    (ARRAY['MEERKAT', 'PANDA', 'OWL', 'BEAVER', 'ELEPHANT', 'OTTER', 'PARROT', 'COLLIE'])[floor(random() * 8 + 1)]
)
WHERE funcode IS NULL;

-- 4. Generate funCodes for existing students that don't have them
UPDATE students 
SET funcode = CONCAT(
    (ARRAY['BRAVE', 'SMART', 'QUICK', 'WISE', 'FRIENDLY', 'CLEVER', 'BRIGHT', 'JOLLY', 'HAPPY', 'FUNNY'])[floor(random() * 10 + 1)],
    '-',
    (ARRAY['MEERKAT', 'PANDA', 'OWL', 'BEAVER', 'ELEPHANT', 'OTTER', 'PARROT', 'COLLIE'])[floor(random() * 8 + 1)]
)
WHERE funcode IS NULL;

-- 5. Make funcode NOT NULL for classes
ALTER TABLE classes ALTER COLUMN funcode SET NOT NULL;

-- 6. Make funcode NOT NULL for students  
ALTER TABLE students ALTER COLUMN funcode SET NOT NULL;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_classes_funcode ON classes(funcode);
CREATE INDEX IF NOT EXISTS idx_students_funcode ON students(funcode);

-- 8. Update quiz_submissions to use student_id instead of passport_code
-- (This was already done in the previous migration, but ensuring it's correct)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'quiz_submissions' AND column_name = 'passport_code') THEN
        ALTER TABLE quiz_submissions DROP COLUMN passport_code;
    END IF;
END $$;

-- 9. Ensure student_id column exists in quiz_submissions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_submissions' AND column_name = 'student_id') THEN
        ALTER TABLE quiz_submissions ADD COLUMN student_id UUID REFERENCES students(id);
    END IF;
END $$;

-- 10. Add payment-related columns to classes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'paymentLinkId') THEN
        ALTER TABLE classes ADD COLUMN paymentLinkId VARCHAR(255);
    END IF;
END $$;

-- 11. Add session management columns to classes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'sessionactive') THEN
        ALTER TABLE classes ADD COLUMN sessionactive BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'sessionstartedat') THEN
        ALTER TABLE classes ADD COLUMN sessionstartedat TIMESTAMP;
    END IF;
END $$;

-- 12. Remove old passport code columns (optional - keeping for now for safety)
-- ALTER TABLE classes DROP COLUMN IF EXISTS passportCode;
-- ALTER TABLE students DROP COLUMN IF EXISTS passportCode;

-- 13. Add comments to document the new system
COMMENT ON COLUMN classes.funcode IS 'Classroom code for student access (e.g., HAPPY-LION)';
COMMENT ON COLUMN students.funcode IS 'Student fun code for authentication (e.g., BRAVE-ELEPHANT)';
COMMENT ON COLUMN classes.sessionactive IS 'Whether classroom session is currently active for student access';
COMMENT ON COLUMN classes.sessionstartedat IS 'When the classroom session was started'; 