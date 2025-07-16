-- Comprehensive Performance Indexes for Beta Launch
-- Created: January 25, 2025
-- Run this in your Supabase SQL Editor before beta testing

-- ========================================
-- CRITICAL INDEXES FOR BETA LAUNCH
-- ========================================

-- 1. Students table - Most critical for authentication and lookups
CREATE INDEX IF NOT EXISTS idx_students_passport 
ON students(passport_code);

CREATE INDEX IF NOT EXISTS idx_students_class_id 
ON students(class_id);

CREATE INDEX IF NOT EXISTS idx_students_class_passport 
ON students(class_id, passport_code);

-- 2. Student Inventory - Critical for store and room features
CREATE INDEX IF NOT EXISTS idx_inventory_student 
ON student_inventory(student_id);

CREATE INDEX IF NOT EXISTS idx_inventory_student_equipped 
ON student_inventory(student_id, is_equipped);

-- 3. Currency Transactions - For economy tracking
CREATE INDEX IF NOT EXISTS idx_currency_transactions_student 
ON currency_transactions(student_id, created_at DESC);

-- 4. Quiz Submissions - For analytics and student creation
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student 
ON quiz_submissions(student_id);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_class_analytics 
ON quiz_submissions(student_id, animal_type_id, genius_type_id, completed_at DESC);

-- 5. Classes - For teacher queries
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id 
ON classes(teacher_id);

CREATE INDEX IF NOT EXISTS idx_classes_code 
ON classes(class_code);

CREATE INDEX IF NOT EXISTS idx_classes_active 
ON classes(is_active, teacher_id);

-- 6. Store Items - For efficient store loading
CREATE INDEX IF NOT EXISTS idx_store_items_active 
ON store_items(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_store_items_category_active 
ON store_items(item_type_id, is_active, sort_order);

-- 7. Pets - For pet system queries
CREATE INDEX IF NOT EXISTS idx_student_pets_student 
ON student_pets(student_id);

-- 8. Room Visits - For social features
CREATE INDEX IF NOT EXISTS idx_room_visits_visitor 
ON room_visits(visitor_student_id, visited_student_id);

CREATE INDEX IF NOT EXISTS idx_room_visits_room 
ON room_visits(visited_student_id, last_visit_at DESC);

-- 9. Guestbook - For room messages
CREATE INDEX IF NOT EXISTS idx_guestbook_room 
ON room_guestbook(room_owner_student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guestbook_moderation 
ON room_guestbook(status) WHERE status = 'flagged_for_review';

-- 10. Game Scores - For leaderboards
CREATE INDEX IF NOT EXISTS idx_game_scores_class_game 
ON game_scores(class_id, game_type, score DESC);

-- 11. Class Values Votes - For voting system
CREATE INDEX IF NOT EXISTS idx_values_votes_session_student 
ON class_values_votes(session_id, student_id);

-- 12. Achievements - For tracking progress
CREATE INDEX IF NOT EXISTS idx_achievements_student 
ON student_achievements(student_id);

-- ========================================
-- VERIFY INDEXES WERE CREATED
-- ========================================

-- Check all indexes on critical tables
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'students', 
    'student_inventory', 
    'currency_transactions', 
    'quiz_submissions',
    'classes',
    'store_items',
    'student_pets',
    'room_visits',
    'room_guestbook',
    'game_scores'
)
ORDER BY tablename, indexname;

-- ========================================
-- ANALYZE TABLES FOR QUERY OPTIMIZATION
-- ========================================

-- Update statistics for query planner
ANALYZE students;
ANALYZE student_inventory;
ANALYZE currency_transactions;
ANALYZE quiz_submissions;
ANALYZE classes;
ANALYZE store_items;
ANALYZE student_pets;
ANALYZE room_visits;
ANALYZE room_guestbook;
ANALYZE game_scores;
ANALYZE class_values_votes;
ANALYZE student_achievements;

-- ========================================
-- PERFORMANCE CHECK QUERIES
-- ========================================

-- Test query performance after indexes
-- You should see "Index Scan" instead of "Seq Scan" in the output

-- Test 1: Student passport lookup (most critical)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM students WHERE passport_code = 'TEST-123';

-- Test 2: Student inventory lookup
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM student_inventory WHERE student_id = 'test-id';

-- Test 3: Class roster query
EXPLAIN (ANALYZE, BUFFERS)
SELECT s.* FROM students s WHERE s.class_id = 'test-class-id';

-- ========================================
-- NOTES
-- ========================================
-- 1. These indexes are essential for beta performance
-- 2. Run this BEFORE inviting teachers to test
-- 3. Monitor slow queries in Supabase dashboard
-- 4. Add more indexes as needed based on slow query log