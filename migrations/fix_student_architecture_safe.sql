-- SAFE MIGRATION: Move student data from quiz_submissions to students table
-- This is a non-destructive migration that preserves existing data

-- Step 1: Add missing columns to students table (safe - won't error if they already exist)
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
ADD COLUMN IF NOT EXISTS student_name TEXT NOT NULL DEFAULT 'Unknown';

-- Step 2: Create proper indexes on the students table
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_passport_code ON students(passport_code);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- Step 3: Add student_id column to quiz_submissions if it doesn't exist
ALTER TABLE quiz_submissions 
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

-- Step 4: Change foreign key column types in dependent tables
-- First, we need to add new UUID columns
ALTER TABLE currency_transactions 
ADD COLUMN IF NOT EXISTS student_id_new UUID;

ALTER TABLE purchase_requests 
ADD COLUMN IF NOT EXISTS student_id_new UUID;

-- Step 5: Populate students table from quiz_submissions for any existing data
-- This is idempotent - won't create duplicates thanks to unique passport_code
INSERT INTO students (
  class_id,
  display_name,
  student_name,
  passport_code,
  wallet_balance,
  pending_balance,
  currency_balance,
  grade_level,
  animal_type,
  animal_genius,
  personality_type,
  learning_style,
  learning_scores,
  avatar_data,
  room_data
)
SELECT DISTINCT ON (passport_code)
  class_id,
  student_name,
  student_name,
  passport_code,
  currency_balance,
  0,
  currency_balance,
  grade_level,
  animal_type,
  animal_genius,
  personality_type,
  learning_style,
  learning_scores,
  avatar_data,
  room_data
FROM quiz_submissions
WHERE passport_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM students s WHERE s.passport_code = quiz_submissions.passport_code
  )
ORDER BY passport_code, completed_at DESC;

-- Step 6: Update quiz_submissions to link to students
UPDATE quiz_submissions qs
SET student_id = s.id
FROM students s
WHERE qs.passport_code = s.passport_code
  AND qs.student_id IS NULL;

-- Step 7: Migrate currency_transactions to use student UUIDs
UPDATE currency_transactions ct
SET student_id_new = s.id
FROM quiz_submissions qs
JOIN students s ON qs.passport_code = s.passport_code
WHERE ct.student_id = qs.id
  AND ct.student_id_new IS NULL;

-- Step 8: Migrate purchase_requests to use student UUIDs
UPDATE purchase_requests pr
SET student_id_new = s.id
FROM quiz_submissions qs
JOIN students s ON qs.passport_code = s.passport_code
WHERE pr.student_id = qs.id
  AND pr.student_id_new IS NULL;

-- Step 9: Drop old constraints and columns, rename new ones
-- Only do this after verifying the migration worked!
-- Run these commands separately after checking data:

-- ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_student_id_fkey;
-- ALTER TABLE currency_transactions DROP COLUMN IF EXISTS student_id;
-- ALTER TABLE currency_transactions RENAME COLUMN student_id_new TO student_id;
-- ALTER TABLE currency_transactions ALTER COLUMN student_id SET NOT NULL;
-- ALTER TABLE currency_transactions 
-- ADD CONSTRAINT currency_transactions_student_id_fkey 
-- FOREIGN KEY (student_id) REFERENCES students(id);

-- ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_student_id_fkey;
-- ALTER TABLE purchase_requests DROP COLUMN IF EXISTS student_id;
-- ALTER TABLE purchase_requests RENAME COLUMN student_id_new TO student_id;
-- ALTER TABLE purchase_requests ALTER COLUMN student_id SET NOT NULL;
-- ALTER TABLE purchase_requests 
-- ADD CONSTRAINT purchase_requests_student_id_fkey 
-- FOREIGN KEY (student_id) REFERENCES students(id);

-- Step 10: Remove duplicate columns from quiz_submissions (after verification)
-- ALTER TABLE quiz_submissions 
-- DROP COLUMN IF EXISTS passport_code,
-- DROP COLUMN IF EXISTS currency_balance,
-- DROP COLUMN IF EXISTS avatar_data,
-- DROP COLUMN IF EXISTS room_data;

-- Step 11: Create indexes on the corrected foreign keys
CREATE INDEX IF NOT EXISTS idx_currency_transactions_student_id ON currency_transactions(student_id_new);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_student_id ON purchase_requests(student_id_new);

-- Add comments explaining the proper architecture
COMMENT ON TABLE students IS 'Primary table for student profiles - contains all student data including avatar, room, and currency';
COMMENT ON TABLE quiz_submissions IS 'Transactional table for quiz attempts only - no profile data should be stored here';
