-- Migration: Convert to UUID-based foreign keys for Supabase auth
-- This removes the old users table and updates all foreign keys to use UUIDs

-- Drop existing foreign key constraints
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_teacher_id_users_id_fk;
ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_teacher_id_users_id_fk;
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_teacher_id_users_id_fk;
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_users_id_fk;
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_target_user_id_users_id_fk;
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_processed_by_users_id_fk;

-- Update classes table
ALTER TABLE classes 
  ALTER COLUMN teacher_id TYPE TEXT USING teacher_id::TEXT;

-- Update lesson_progress table  
ALTER TABLE lesson_progress
  ALTER COLUMN teacher_id TYPE TEXT USING teacher_id::TEXT;

-- Update currency_transactions table
ALTER TABLE currency_transactions
  ALTER COLUMN teacher_id TYPE TEXT USING teacher_id::TEXT;

-- Update admin_logs table
ALTER TABLE admin_logs
  ALTER COLUMN admin_id TYPE TEXT USING admin_id::TEXT,
  ALTER COLUMN target_user_id TYPE TEXT USING target_user_id::TEXT;

-- Update purchase_requests table
ALTER TABLE purchase_requests
  ALTER COLUMN processed_by TYPE TEXT USING processed_by::TEXT;

-- Drop the old users table
DROP TABLE IF EXISTS users CASCADE;

-- Add new foreign key constraints to profiles table
ALTER TABLE classes 
  ADD CONSTRAINT classes_teacher_id_profiles_id_fk 
  FOREIGN KEY (teacher_id) REFERENCES profiles(id);

ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_teacher_id_profiles_id_fk
  FOREIGN KEY (teacher_id) REFERENCES profiles(id);

ALTER TABLE currency_transactions
  ADD CONSTRAINT currency_transactions_teacher_id_profiles_id_fk
  FOREIGN KEY (teacher_id) REFERENCES profiles(id);

ALTER TABLE admin_logs
  ADD CONSTRAINT admin_logs_admin_id_profiles_id_fk
  FOREIGN KEY (admin_id) REFERENCES profiles(id),
  ADD CONSTRAINT admin_logs_target_user_id_profiles_id_fk
  FOREIGN KEY (target_user_id) REFERENCES profiles(id);

ALTER TABLE purchase_requests
  ADD CONSTRAINT purchase_requests_processed_by_profiles_id_fk
  FOREIGN KEY (processed_by) REFERENCES profiles(id);

-- Clear all existing data for a fresh start
TRUNCATE TABLE purchase_requests CASCADE;
TRUNCATE TABLE currency_transactions CASCADE;
TRUNCATE TABLE store_settings CASCADE;
TRUNCATE TABLE lesson_progress CASCADE;
TRUNCATE TABLE admin_logs CASCADE;
TRUNCATE TABLE quiz_submissions CASCADE;
TRUNCATE TABLE students CASCADE;
TRUNCATE TABLE classes CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- Ensure at least one profile exists with admin privileges
-- (You'll need to create this through Supabase Auth)
