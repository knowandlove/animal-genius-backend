-- Phase 2: Database Simplification Migration
-- Date: January 2025
-- Purpose: Remove unused payment features and simplify schema

-- 1. Drop unused tables (all confirmed empty)
DROP TABLE IF EXISTS teacher_payments CASCADE;
DROP TABLE IF EXISTS activations CASCADE;
DROP TABLE IF EXISTS classroom_sessions CASCADE;

-- 2. Remove payment-related columns from classes table
ALTER TABLE classes 
DROP COLUMN IF EXISTS paid_at,
DROP COLUMN IF EXISTS stripe_subscription_id,
DROP COLUMN IF EXISTS paid_student_count,
DROP COLUMN IF EXISTS payment_status,
DROP COLUMN IF EXISTS payment_link_id;

-- 3. Add security option to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS require_passport_code BOOLEAN DEFAULT false;

-- 4. Rename funcode to passport_code in students table for clarity
ALTER TABLE students 
RENAME COLUMN funcode TO passport_code;

-- 5. Add helpful comment
COMMENT ON COLUMN classes.require_passport_code IS 'When true, students must enter their passport code to access another student''s island';
COMMENT ON COLUMN students.passport_code IS 'Unique identifier for student in format ANIMAL-XXX (e.g., MEE-X7K)';
COMMENT ON COLUMN classes.class_code IS '6-digit numeric code for joining a class (e.g., 742951)';
