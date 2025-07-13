-- Simple test to create a class
-- Run this in Supabase SQL Editor

-- First check if we have any teacher
SELECT id, email FROM profiles WHERE is_anonymous = false LIMIT 1;

-- If you have a teacher ID from above, use it here:
-- Replace 'YOUR_TEACHER_ID' with the actual ID
INSERT INTO classes (
  teacher_id,
  name,
  class_code,
  is_active,
  expires_at,
  seat_limit
) VALUES (
  'YOUR_TEACHER_ID', -- <-- REPLACE THIS
  'Test Class',
  'TEST-123',
  true,
  NOW() + INTERVAL '1 year',
  30
);

-- Verify it was created
SELECT id, name, class_code, is_active, expires_at, seat_limit 
FROM classes 
WHERE class_code = 'TEST-123';