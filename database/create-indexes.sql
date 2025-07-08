-- Performance indexes for Animal Genius Backend
-- Run these in your Supabase SQL Editor

-- 1. Speed up student lookups by class and passport code
CREATE INDEX IF NOT EXISTS idx_students_class_passport 
ON students(class_id, passport_code);

-- 2. Speed up fetching quiz submissions for a student
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student 
ON quiz_submissions(student_id, completed_at DESC);

-- 3. Speed up currency transaction history queries
CREATE INDEX IF NOT EXISTS idx_currency_transactions_student 
ON currency_transactions(student_id, created_at DESC);

-- 4. Speed up active store items queries
CREATE INDEX IF NOT EXISTS idx_store_items_active 
ON store_items(is_active, sort_order);

-- 5. Additional index for class analytics query
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_class 
ON quiz_submissions(student_id, animal_type_id, genius_type_id, completed_at DESC);

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('students', 'quiz_submissions', 'currency_transactions', 'store_items')
ORDER BY tablename, indexname;