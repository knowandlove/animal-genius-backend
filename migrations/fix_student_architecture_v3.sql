-- CLEAN SLATE: Reset tables to use proper architecture
-- Since there's no production data, we can fix the architecture properly

-- Step 1: Drop all foreign key constraints pointing to quiz_submissions
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_student_id_fkey;
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_student_id_fkey;

-- Step 2: Clear all test data
TRUNCATE TABLE purchase_requests CASCADE;
TRUNCATE TABLE currency_transactions CASCADE;
TRUNCATE TABLE quiz_submissions CASCADE;
TRUNCATE TABLE students CASCADE;
TRUNCATE TABLE store_settings CASCADE;
TRUNCATE TABLE lesson_progress CASCADE;
TRUNCATE TABLE classes CASCADE;
TRUNCATE TABLE users CASCADE;

-- Step 3: Add missing columns to students table (where student profiles SHOULD live)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS grade_level TEXT,
ADD COLUMN IF NOT EXISTS animal_type TEXT NOT NULL DEFAULT 'meerkat',
ADD COLUMN IF NOT EXISTS animal_genius TEXT NOT NULL DEFAULT 'Feeler',
ADD COLUMN IF NOT EXISTS personality_type VARCHAR(4),
ADD COLUMN IF NOT EXISTS learning_style TEXT,
ADD COLUMN IF NOT EXISTS learning_scores JSONB DEFAULT '{}' NOT NULL,
ADD COLUMN IF NOT EXISTS avatar_data JSONB DEFAULT '{}' NOT NULL,
ADD COLUMN IF NOT EXISTS room_data JSONB DEFAULT '{}' NOT NULL,
ADD COLUMN IF NOT EXISTS currency_balance INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS student_name TEXT NOT NULL;

-- Step 4: Remove duplicate columns from quiz_submissions (they belong in students table)
ALTER TABLE quiz_submissions 
DROP COLUMN IF EXISTS passport_code,
DROP COLUMN IF EXISTS currency_balance,
DROP COLUMN IF EXISTS avatar_data,
DROP COLUMN IF EXISTS room_data;

-- Step 5: Drop and recreate the student_id columns with correct UUID type
ALTER TABLE currency_transactions DROP COLUMN IF EXISTS student_id;
ALTER TABLE currency_transactions ADD COLUMN student_id UUID NOT NULL;
ALTER TABLE currency_transactions 
ADD CONSTRAINT currency_transactions_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE purchase_requests DROP COLUMN IF EXISTS student_id;
ALTER TABLE purchase_requests ADD COLUMN student_id UUID NOT NULL;
ALTER TABLE purchase_requests 
ADD CONSTRAINT purchase_requests_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id);

-- Step 6: Create proper indexes on the students table
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_passport_code ON students(passport_code);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- Step 7: Create indexes on the corrected foreign keys
CREATE INDEX IF NOT EXISTS idx_currency_transactions_student_id ON currency_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_student_id ON purchase_requests(student_id);

-- Add comments explaining the proper architecture
COMMENT ON TABLE students IS 'Primary table for student profiles - contains all student data including avatar, room, and currency';
COMMENT ON TABLE quiz_submissions IS 'Transactional table for quiz attempts only - no profile data should be stored here';
