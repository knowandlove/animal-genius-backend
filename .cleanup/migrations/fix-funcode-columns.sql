-- Simple migration to fix funcode columns
-- This only adds missing columns and doesn't fail if they exist

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

-- 5. Make funcode NOT NULL for classes (only if column exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'classes' AND column_name = 'funcode') THEN
        ALTER TABLE classes ALTER COLUMN funcode SET NOT NULL;
    END IF;
END $$;

-- 6. Make funcode NOT NULL for students (only if column exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'students' AND column_name = 'funcode') THEN
        ALTER TABLE students ALTER COLUMN funcode SET NOT NULL;
    END IF;
END $$;

-- 7. Create indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_classes_funcode ON classes(funcode);
CREATE INDEX IF NOT EXISTS idx_students_funcode ON students(funcode); 