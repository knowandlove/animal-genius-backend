-- Migration: Convert to UUID-based foreign keys for Supabase auth
-- This removes the old users table and updates all foreign keys to use UUIDs

-- First, drop all existing foreign key constraints
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_teacher_id_fkey;
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_teacher_id_users_id_fk;
ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_teacher_id_fkey;
ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_teacher_id_users_id_fk;
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_teacher_id_fkey;
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_teacher_id_users_id_fk;
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_users_id_fk;
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_target_user_id_fkey;
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_target_user_id_users_id_fk;
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_processed_by_fkey;
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_processed_by_users_id_fk;

-- Clear all data since we're starting fresh
TRUNCATE TABLE purchase_requests CASCADE;
TRUNCATE TABLE currency_transactions CASCADE;
TRUNCATE TABLE store_settings CASCADE;
TRUNCATE TABLE lesson_progress CASCADE;
TRUNCATE TABLE admin_logs CASCADE;
TRUNCATE TABLE quiz_submissions CASCADE;
TRUNCATE TABLE students CASCADE;
TRUNCATE TABLE classes CASCADE;

-- Now update the column types to UUID
-- Generate random UUIDs for any existing integer values (though we truncated, this is for safety)
ALTER TABLE classes 
  ALTER COLUMN teacher_id TYPE UUID USING gen_random_uuid();

ALTER TABLE lesson_progress
  ALTER COLUMN teacher_id TYPE UUID USING gen_random_uuid();

ALTER TABLE currency_transactions
  ALTER COLUMN teacher_id TYPE UUID USING gen_random_uuid();

ALTER TABLE admin_logs
  ALTER COLUMN admin_id TYPE UUID USING gen_random_uuid(),
  ALTER COLUMN target_user_id TYPE UUID USING gen_random_uuid();

ALTER TABLE purchase_requests
  ALTER COLUMN processed_by TYPE UUID USING gen_random_uuid();

-- Drop the old users table if it exists
DROP TABLE IF EXISTS users CASCADE;

-- Now add the new foreign key constraints to profiles table
ALTER TABLE classes 
  ADD CONSTRAINT classes_teacher_id_profiles_id_fk 
  FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_teacher_id_profiles_id_fk
  FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE currency_transactions
  ADD CONSTRAINT currency_transactions_teacher_id_profiles_id_fk
  FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE admin_logs
  ADD CONSTRAINT admin_logs_admin_id_profiles_id_fk
  FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT admin_logs_target_user_id_profiles_id_fk
  FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE purchase_requests
  ADD CONSTRAINT purchase_requests_processed_by_profiles_id_fk
  FOREIGN KEY (processed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Clear profiles table as well for a fresh start
TRUNCATE TABLE profiles CASCADE;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Migration completed successfully! The database now uses UUID-based authentication.';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Clear all users in Supabase Auth dashboard';
  RAISE NOTICE '2. Create a new admin user through the registration page';
  RAISE NOTICE '3. Update the new user is_admin flag in the profiles table';
END $$;
