-- Create a test class to verify the system works
-- Run this in Supabase SQL Editor

-- First, create a test teacher profile if one doesn't exist
DO $$
DECLARE
  v_teacher_id UUID;
BEGIN
  -- Check if we have any teacher
  SELECT id INTO v_teacher_id FROM profiles WHERE is_anonymous = false LIMIT 1;
  
  IF v_teacher_id IS NULL THEN
    -- Create a test teacher
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_anonymous,
      aud,
      role
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'testteacher@animalgenius.local',
      crypt('testpass123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"role": "teacher"}'::jsonb,
      '{"full_name": "Test Teacher"}'::jsonb,
      false,
      'authenticated',
      'authenticated'
    ) RETURNING id INTO v_teacher_id;
    
    -- Create profile
    INSERT INTO profiles (id, email, full_name, is_anonymous)
    VALUES (v_teacher_id, 'testteacher@animalgenius.local', 'Test Teacher', false);
  END IF;
  
  -- Create test class
  INSERT INTO classes (
    teacher_id,
    name,
    subject,
    grade_level,
    class_code,
    school_name,
    seat_limit,
    expires_at,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_teacher_id,
    'Test Math Class',
    'Mathematics',
    '5th Grade',
    'TEST-123',
    'Animal Genius Test School',
    30, -- seat limit
    NOW() + INTERVAL '1 year', -- expires in 1 year
    true, -- is active
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Test class created with code: TEST-123';
END $$;

-- Verify the class was created
SELECT 
  name,
  class_code,
  seat_limit,
  expires_at,
  is_active
FROM classes 
WHERE class_code = 'TEST-123';