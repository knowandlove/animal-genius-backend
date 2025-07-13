-- Complete test setup
-- Run this entire script in Supabase SQL Editor

-- 1. Add missing column if needed
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false NOT NULL;

-- 2. Get any existing teacher or create one
DO $$
DECLARE
  v_teacher_id UUID;
  v_class_id UUID;
BEGIN
  -- Try to get existing teacher
  SELECT id INTO v_teacher_id FROM profiles LIMIT 1;
  
  -- If no profiles exist, we need to create a teacher
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'No profiles found. Please create a teacher account first through your app.';
  END IF;
  
  -- Check if TEST-123 already exists
  SELECT id INTO v_class_id FROM classes WHERE class_code = 'TEST-123';
  
  IF v_class_id IS NOT NULL THEN
    -- Update existing class
    UPDATE classes 
    SET 
      is_active = true,
      expires_at = NOW() + INTERVAL '1 year',
      seat_limit = 30
    WHERE class_code = 'TEST-123';
    
    RAISE NOTICE 'Updated existing TEST-123 class';
  ELSE
    -- Create new test class
    INSERT INTO classes (
      teacher_id,
      name,
      class_code,
      is_active,
      expires_at,
      seat_limit,
      created_at,
      updated_at
    ) VALUES (
      v_teacher_id,
      'Test Class for Auth',
      'TEST-123',
      true,
      NOW() + INTERVAL '1 year',
      30,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created new TEST-123 class';
  END IF;
END $$;

-- 3. Verify the class is ready
SELECT 
  id,
  name,
  class_code,
  is_active,
  expires_at,
  seat_limit,
  CASE 
    WHEN is_active = true AND (expires_at IS NULL OR expires_at > NOW()) 
    THEN '✅ Ready for testing!'
    ELSE '❌ Not active or expired'
  END as status
FROM classes 
WHERE class_code = 'TEST-123';