-- Migration script to populate UUID columns with existing data
-- This should be run AFTER the schema changes but BEFORE switching to the new auth system

-- First, let's migrate existing users to profiles
-- This assumes you've already created the profiles table with the new schema

-- Step 1: Insert existing users into Supabase auth.users (this would be done via Supabase admin API)
-- For now, we'll just document the process

-- Step 2: After users are created in auth.users, populate the profiles table
-- You'll need to map the numeric IDs to the new UUIDs
-- This would typically be done with a script that:
-- 1. Creates users in Supabase Auth
-- 2. Maps old numeric IDs to new UUIDs
-- 3. Updates all foreign key references

-- Example mapping table (temporary)
CREATE TABLE IF NOT EXISTS user_id_mapping (
  old_id INTEGER PRIMARY KEY,
  new_uuid UUID NOT NULL
);

-- After populating the mapping table, update foreign keys:

-- Update classes
UPDATE classes c
SET teacher_uuid = m.new_uuid
FROM user_id_mapping m
WHERE c.teacher_id = m.old_id;

-- Update purchase_requests
UPDATE purchase_requests pr
SET processed_by_uuid = m.new_uuid
FROM user_id_mapping m
WHERE pr.processed_by = m.old_id;

-- Update currency_transactions
UPDATE currency_transactions ct
SET teacher_uuid = m.new_uuid
FROM user_id_mapping m
WHERE ct.teacher_id = m.old_id;

-- Update admin_logs
UPDATE admin_logs al
SET admin_uuid = m.new_uuid
FROM user_id_mapping m
WHERE al.admin_id = m.old_id;

UPDATE admin_logs al
SET target_user_uuid = m.new_uuid
FROM user_id_mapping m
WHERE al.target_user_id = m.old_id;

-- Update lesson_progress
UPDATE lesson_progress lp
SET teacher_uuid = m.new_uuid
FROM user_id_mapping m
WHERE lp.teacher_id = m.old_id;

-- After all data is migrated, you can:
-- 1. Drop the old foreign key constraints
-- 2. Drop the old integer columns
-- 3. Rename the UUID columns to remove the _uuid suffix
-- 4. Add new foreign key constraints to the profiles table
-- 5. Drop the mapping table
