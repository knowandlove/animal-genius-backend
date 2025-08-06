-- Fix the animal type lookup to use LOWER() again
-- The avatar migration accidentally removed this, breaking quiz submissions

CREATE OR REPLACE FUNCTION public.create_student_from_quiz_with_results(
  p_class_code TEXT,
  first_name TEXT,
  last_initial TEXT,
  grade TEXT,
  quiz_answers JSONB,
  p_user_id UUID,
  calculated_animal TEXT,
  calculated_genius TEXT,
  calculated_mbti TEXT,
  calculated_learning_style TEXT
) RETURNS JSONB AS $$
DECLARE
  v_class_id UUID;
  v_seat_limit INTEGER;
  v_student_id UUID;
  v_submission_id UUID;
  v_passport_code TEXT;
  v_student_name TEXT;
  v_student_count INTEGER;
  v_animal_type_id UUID;
  v_genius_type_id UUID;
  v_starting_balance INTEGER := 50;
BEGIN
  -- 0. Wait for user to replicate from Auth service to database
  DECLARE
    v_user_exists BOOLEAN := false;
    v_retries INT := 5;
  BEGIN
    WHILE v_retries > 0 AND NOT v_user_exists LOOP
      SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
      IF NOT v_user_exists THEN
        PERFORM pg_sleep(0.2);
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
  
  -- 2. Check class capacity
  SELECT COUNT(*) INTO v_student_count FROM public.students WHERE class_id = v_class_id;
  
  IF v_seat_limit IS NOT NULL AND v_student_count >= v_seat_limit THEN
    RAISE EXCEPTION 'CLASS_FULL: This class is full. Please contact your teacher.';
  END IF;
  
  -- 3. Check for name collision
  v_student_name := first_name || ' ' || last_initial || '.';
  
  IF EXISTS (SELECT 1 FROM public.students WHERE class_id = v_class_id AND student_name = v_student_name) THEN
    RAISE EXCEPTION 'NAME_COLLISION: A student named % already exists in this class. Try adding your middle initial.', v_student_name;
  END IF;

  -- 4. Look up animal and genius types (FIX: Add LOWER() and handle spaces)
  SELECT id INTO v_animal_type_id FROM public.animal_types 
  WHERE code = LOWER(REPLACE(calculated_animal, ' ', '_'));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid animal type: %', calculated_animal;
  END IF;
  
  SELECT id INTO v_genius_type_id FROM public.genius_types WHERE code = LOWER(calculated_genius);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid genius type: %', calculated_genius;
  END IF;
  
  -- 5. Generate a unique passport code with retry logic
  DECLARE
    v_attempts INT := 0;
    v_max_attempts INT := 10;
  BEGIN
    WHILE v_attempts < v_max_attempts LOOP
      v_passport_code := public.generate_passport_code(calculated_animal);
      
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE passport_code = v_passport_code);
      
      v_attempts := v_attempts + 1;
      IF v_attempts >= v_max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique passport code after % attempts', v_max_attempts;
      END IF;
    END LOOP;
  END;
  
  -- 6. Create student with pre-calculated results AND initialize avatar_data
  INSERT INTO public.students (
    class_id, user_id, student_name, grade_level, passport_code,
    personality_type, animal_type_id, genius_type_id, currency_balance,
    learning_style, school_year, created_at, avatar_data
  ) VALUES (
    v_class_id, p_user_id, v_student_name, grade, v_passport_code,
    calculated_mbti, v_animal_type_id, v_genius_type_id, v_starting_balance,
    calculated_learning_style, EXTRACT(YEAR FROM CURRENT_DATE), NOW(),
    jsonb_build_object(
      'colors', jsonb_build_object(
        'hasCustomized', false,
        'primaryColor', null,
        'secondaryColor', null
      )
    )
  ) RETURNING id INTO v_student_id;
  
  -- 7. Create quiz_submission record with pre-calculated results
  INSERT INTO public.quiz_submissions (
    student_id, animal_type_id, genius_type_id, 
    answers, coins_earned, completed_at, created_at
  ) VALUES (
    v_student_id, v_animal_type_id, v_genius_type_id,
    quiz_answers::jsonb, v_starting_balance, NOW(), NOW()
  ) RETURNING id INTO v_submission_id;
  
  -- 8. Log the joining coins transaction
  INSERT INTO public.currency_transactions (
    student_id, amount, reason, description, reference_id
  ) VALUES (
    v_student_id, v_starting_balance, 'quiz_completion', 
    'Welcome bonus for joining the class', v_submission_id::text
  );
  
  -- 10. Return success with all needed data
  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'passport_code', v_passport_code,
    'animal_type', calculated_animal,
    'genius_type', calculated_genius,
    'first_name', first_name
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public, auth;

GRANT EXECUTE ON FUNCTION public.create_student_from_quiz_with_results TO anon, authenticated;