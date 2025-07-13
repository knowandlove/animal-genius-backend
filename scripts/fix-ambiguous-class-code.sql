-- Fix the ambiguous column reference in submit_quiz_atomic function
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
  -- Check if class exists and is active
  -- FIX: Use table prefix to avoid ambiguity
  SELECT c.id, c.seat_limit INTO v_class_id, v_seat_limit
  FROM classes c
  WHERE c.class_code = submit_quiz_atomic.class_code
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
    
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Class code % not found or inactive', class_code;
  END IF;
  
  -- Check seat limit
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
  
  -- Calculate animal type
  v_animal_type := calculate_animal_type(quiz_answers);
  
  -- Create anonymous auth user
  v_anon_user_id := gen_random_uuid();
  v_passport_code := generate_passport_code();
  
  -- This would normally create an auth user, but we'll store the mapping
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
  
  -- Create student record
  INSERT INTO students (
    student_name,
    class_id,
    animal_type,
    passport_code,
    user_id,
    school_year,
    quiz_score,
    created_at,
    updated_at
  ) VALUES (
    first_name || ' ' || last_initial,
    v_class_id,
    v_animal_type,
    v_passport_code,
    v_anon_user_id,
    grade,
    (quiz_answers->>'score')::INTEGER,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
EOF < /dev/null