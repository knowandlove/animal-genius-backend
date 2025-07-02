-- Critical performance indexes for student island loading
-- These prevent full table scans during the "start of class" thundering herd

-- URGENT: Index for passport code lookups (this is the PRIMARY lookup key!)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_submissions_passport_code 
ON quiz_submissions(passport_code);

-- Index for joining with classes table
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_class_id 
ON quiz_submissions(class_id);

-- Index for purchase requests by student
CREATE INDEX IF NOT EXISTS idx_purchase_requests_student_id 
ON purchase_requests(student_id);

-- Index for store settings by class
CREATE INDEX IF NOT EXISTS idx_store_settings_class_id 
ON store_settings(class_id);

-- Index for store items that are active (used in every catalog query)
CREATE INDEX IF NOT EXISTS idx_store_items_active 
ON store_items(is_active) 
WHERE is_active = true;

-- Composite index for purchase requests (student + status for pending checks)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_student_status 
ON purchase_requests(student_id, status);

-- Add comment explaining why these are critical
COMMENT ON INDEX idx_quiz_submissions_passport_code IS 'Critical for student island loading - prevents full table scan on every page load';
COMMENT ON INDEX idx_quiz_submissions_class_id IS 'Critical for joining student data with class information';
