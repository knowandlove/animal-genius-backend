-- Migration: Fix store settings and add missing indexes
-- Date: June 15, 2025

-- 1. Add unique constraint to store_settings to prevent duplicate records per class
ALTER TABLE store_settings 
ADD CONSTRAINT unique_store_per_class UNIQUE (class_id);

-- 2. Add indexes for better query performance
-- Index for purchase_requests queries by student
CREATE INDEX idx_purchase_requests_student_id ON purchase_requests(student_id);

-- Composite index for finding pending requests
CREATE INDEX idx_purchase_requests_student_status ON purchase_requests(student_id, status);

-- Index for store_settings by class (even though it's unique, explicit index helps)
CREATE INDEX idx_store_settings_class_id ON store_settings(class_id);

-- 3. Create default store settings for existing classes that don't have any
INSERT INTO store_settings (class_id, is_open, created_at)
SELECT c.id, true, NOW()
FROM classes c
LEFT JOIN store_settings ss ON c.id = ss.class_id
WHERE ss.id IS NULL;

-- 4. Add helpful comment
COMMENT ON TABLE store_settings IS 'Store configuration per class. Each class has exactly one store setting.';
COMMENT ON COLUMN store_settings.is_open IS 'Whether the store is currently open for purchases. Defaults to false for new classes.';