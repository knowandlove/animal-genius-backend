-- Complete Store Wipe SQL Script
-- Run this in your Supabase SQL Editor to completely clean the store

-- 1. Delete all store items
DELETE FROM store_items;

-- 2. Delete all purchase requests
DELETE FROM purchase_requests;

-- 3. Clear all owned items from students
UPDATE quiz_submissions
SET avatar_data = jsonb_set(
    jsonb_set(
        COALESCE(avatar_data, '{}')::jsonb, 
        '{owned}', 
        '[]'::jsonb
    ),
    '{equipped}',
    '{}'::jsonb
)
WHERE avatar_data IS NOT NULL;

-- 4. Show results
SELECT 'Store wipe complete!' as status;
