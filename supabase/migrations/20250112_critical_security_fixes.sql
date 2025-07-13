-- CRITICAL SECURITY FIXES - Apply Immediately

-- 1. Fix race condition in submit_quiz_atomic by proper locking
CREATE OR REPLACE FUNCTION submit_quiz_atomic(
  class_code TEXT,
  first_name TEXT,
  last_initial TEXT,
  grade TEXT,
  quiz_answers JSONB
) RETURNS JSONB AS $$
DECLARE
  v_class_id UUID;
  v_seat_limit INTEGER;
  v_student_id UUID;
  v_anon_user_id UUID;
  v_passport_code TEXT;
  v_animal_type TEXT;
  v_profile_id UUID;
  v_student_count INTEGER;
BEGIN
  -- CRITICAL FIX: Use FOR UPDATE to prevent race conditions
  SELECT c.id, c.seat_limit INTO v_class_id, v_seat_limit
  FROM classes c
  WHERE UPPER(c.class_code) = UPPER(submit_quiz_atomic.class_code)
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > NOW())
  FOR UPDATE; -- This locks the row to prevent concurrent access
    
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Class code % not found or inactive', class_code;
  END IF;
  
  -- Check seat limit AFTER locking to prevent race condition
  IF v_seat_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_student_count
    FROM students
    WHERE class_id = v_class_id;
    
    IF v_student_count >= v_seat_limit THEN
      RAISE EXCEPTION 'Class has reached its capacity of % students', v_seat_limit;
    END IF;
  END IF;
  
  -- Check for name collision
  IF EXISTS (
    SELECT 1 FROM students 
    WHERE class_id = v_class_id 
    AND student_name = first_name || ' ' || last_initial
  ) THEN
    RAISE EXCEPTION 'Student % % already exists in this class', first_name, last_initial;
  END IF;
  
  -- Calculate animal type from personality quiz answers
  v_animal_type := calculate_animal_type(quiz_answers);
  
  -- Create anonymous auth user
  v_anon_user_id := gen_random_uuid();
  v_passport_code := generate_passport_code(v_animal_type);
  
  -- Create auth user record
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (
    v_anon_user_id,
    v_anon_user_id::text || '@anonymous.local',
    crypt(v_passport_code, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('is_anonymous', true)
  );
  
  -- Create profile
  INSERT INTO profiles (id, is_anonymous, created_at, updated_at)
  VALUES (v_anon_user_id, true, now(), now())
  RETURNING id INTO v_profile_id;
  
  -- Create student record (NO quiz_score since this is personality quiz)
  INSERT INTO students (
    student_name,
    class_id,
    animal_type,
    passport_code,
    user_id,
    school_year,
    created_at,
    updated_at
  ) VALUES (
    first_name || ' ' || last_initial,
    v_class_id,
    v_animal_type,
    v_passport_code,
    v_anon_user_id,
    grade,
    now(),
    now()
  ) RETURNING id INTO v_student_id;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'passport_code', v_passport_code,
    'animal_type', v_animal_type,
    'first_name', first_name
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in a function
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- 2. CRITICAL: Remove overly permissive RLS policy for anonymous INSERT
-- This prevents direct writes to students table, forcing use of submit_quiz_atomic
DROP POLICY IF EXISTS "Anonymous can submit quiz" ON students;

-- 3. Add proper RLS policy that only allows the function to insert
CREATE POLICY "Only submit_quiz_atomic can insert students" ON students
  FOR INSERT
  WITH CHECK (false); -- No direct inserts allowed, only through SECURITY DEFINER function