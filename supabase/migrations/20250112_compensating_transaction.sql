-- Create simplified student creation function (no auth user creation)
-- This works with Edge Function Admin API + compensating transaction pattern

CREATE OR REPLACE FUNCTION public.create_student_from_quiz(
  p_class_code TEXT,
  first_name TEXT,
  last_initial TEXT,
  grade TEXT,
  quiz_answers JSONB,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_class_id UUID;
  v_seat_limit INTEGER;
  v_student_id UUID;
  v_passport_code TEXT;
  v_animal_type TEXT;
  v_score DECIMAL;
  v_student_name TEXT;
  v_student_count INTEGER;
  v_animal_type_id UUID;
  v_genius_type_id UUID;
BEGIN
  -- 0. Wait for user to replicate from Auth service to database
  DECLARE
    v_user_exists BOOLEAN := false;
    v_retries INT := 5;
  BEGIN
    -- Poll for user to appear in auth.users replica
    WHILE v_retries > 0 AND NOT v_user_exists LOOP
      SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
      IF NOT v_user_exists THEN
        PERFORM pg_sleep(0.2); -- 200ms wait
        v_retries := v_retries - 1;
      END IF;
    END LOOP;

    IF NOT v_user_exists THEN
      RAISE EXCEPTION 'USER_NOT_FOUND: User % did not replicate in time.', p_user_id;
    END IF;
  END;

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
  
  -- 6. Create student record with provided user_id
  INSERT INTO public.students (
    class_id,
    user_id,
    student_name,
    grade_level,
    passport_code,
    personality_type,
    animal_type_id,
    genius_type_id,
    school_year
  ) VALUES (
    v_class_id,
    p_user_id,
    v_student_name,
    grade,
    v_passport_code,
    v_animal_type,
    v_animal_type_id,
    v_genius_type_id,
    EXTRACT(YEAR FROM CURRENT_DATE)
  ) RETURNING id INTO v_student_id;
  
  -- 7. Update student count in classes
  UPDATE public.classes 
  SET number_of_students = COALESCE(number_of_students, 0) + 1
  WHERE id = v_class_id;
  
  -- 8. Return success with student info
  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'passport_code', v_passport_code,
    'animal_type', v_animal_type,
    'first_name', first_name
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public, auth;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_student_from_quiz TO anon, authenticated;