-- Fix atomic authentication by consolidating user creation and quiz submission
-- This addresses Edge Function platform restrictions on auth.admin API

-- Drop and recreate the function with auth user creation built-in
DROP FUNCTION IF EXISTS public.submit_quiz_atomic(TEXT, TEXT, TEXT, TEXT, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.submit_quiz_atomic(
  p_class_code TEXT,
  first_name TEXT,
  last_initial TEXT,
  grade TEXT,
  quiz_answers JSONB
) RETURNS JSONB AS $$
DECLARE
  v_class_id UUID;
  v_seat_limit INTEGER;
  v_student_id UUID;
  v_user_id UUID;
  v_passport_code TEXT;
  v_animal_type TEXT;
  v_mbti_type TEXT;
  v_score DECIMAL;
  v_student_name TEXT;
  v_student_count INTEGER;
  v_animal_type_id UUID;
  v_genius_type_id UUID;
  v_email TEXT;
  v_password_hash TEXT;
  v_raw_user_meta_data JSONB;
  v_raw_app_meta_data JSONB;
BEGIN
  -- 1. Validate class exists and is active
  SELECT id, seat_limit INTO v_class_id, v_seat_limit
  FROM public.classes 
  WHERE UPPER(class_code) = UPPER(p_class_code)
    AND (expires_at IS NULL OR expires_at > NOW())
    AND is_active = true;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CLASS_CODE: Class code % not found or expired', p_class_code;
  END IF;
  
  -- 2. Check seat limit
  SELECT COUNT(*) INTO v_student_count
  FROM public.students
  WHERE class_id = v_class_id;
  
  IF v_seat_limit IS NOT NULL AND v_student_count >= v_seat_limit THEN
    RAISE EXCEPTION 'CLASS_FULL: Class has reached capacity of % students', v_seat_limit;
  END IF;
  
  -- 3. Check for name collision
  v_student_name := first_name || ' ' || last_initial;
  
  IF EXISTS (
    SELECT 1 FROM public.students 
    WHERE class_id = v_class_id 
    AND student_name = v_student_name
  ) THEN
    RAISE EXCEPTION 'NAME_TAKEN: Student name % already exists in this class', v_student_name;
  END IF;
  
  -- 4. Calculate quiz results
  v_animal_type := public.calculate_animal_type(quiz_answers);
  v_passport_code := public.generate_passport_code(v_animal_type);
  v_score := public.calculate_score(quiz_answers);
  
  -- 5. Get animal and genius type IDs
  SELECT id INTO v_animal_type_id
  FROM public.animal_types
  WHERE LOWER(code) = LOWER(v_animal_type)
  LIMIT 1;
  
  SELECT id INTO v_genius_type_id
  FROM public.genius_types
  WHERE code = CASE 
    WHEN v_animal_type IN ('owl', 'beaver') THEN 'analytical'
    WHEN v_animal_type IN ('meerkat', 'border_collie') THEN 'practical'
    WHEN v_animal_type IN ('octopus', 'dolphin') THEN 'creative'
    ELSE 'social'
  END
  LIMIT 1;
  
  -- 6. CREATE AUTH USER DIRECTLY
  v_user_id := gen_random_uuid();
  v_email := lower(first_name) || '.' || lower(last_initial) || '.' || extract(epoch from now())::text || '@anonymous.local';
  v_password_hash := crypt('student_' || extract(epoch from now())::text || '_' || v_user_id::text, gen_salt('bf'));
  
  v_raw_user_meta_data := jsonb_build_object(
    'first_name', first_name,
    'last_initial', last_initial,
    'is_anonymous', true
  );
  
  v_raw_app_meta_data := jsonb_build_object(
    'provider', 'anonymous',
    'providers', jsonb_build_array('anonymous')
  );
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_password_hash,
    now(),
    v_raw_user_meta_data,
    v_raw_app_meta_data,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Insert into auth.identities  
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
  ) VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email
    ),
    'email',
    now(),
    now(),
    now(),
    gen_random_uuid()
  );
  
  -- 7. Create student record
  INSERT INTO public.students (
    class_id,
    user_id,
    student_name,
    grade_level,
    passport_code,
    personality_type,
    animal_type_id,
    genius_type_id,
    quiz_score,
    school_year
  ) VALUES (
    v_class_id,
    v_user_id,
    v_student_name,
    grade,
    v_passport_code,
    v_animal_type, -- Store animal type as personality_type for now
    v_animal_type_id,
    v_genius_type_id,
    v_score,
    EXTRACT(YEAR FROM CURRENT_DATE)
  ) RETURNING id INTO v_student_id;
  
  -- 8. Update student count in classes
  UPDATE public.classes 
  SET number_of_students = COALESCE(number_of_students, 0) + 1
  WHERE id = v_class_id;
  
  -- 9. Return success with student info
  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'passport_code', v_passport_code,
    'animal_type', v_animal_type,
    'first_name', first_name
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback will happen automatically
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.submit_quiz_atomic TO anon, authenticated;