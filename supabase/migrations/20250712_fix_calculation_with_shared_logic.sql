-- Fix calculation mismatch by using pre-calculated results from shared frontend logic
-- Create new function that accepts calculated results instead of doing calculation in SQL

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
  
  -- 4. Generate passport code (no calculation needed - use pre-calculated animal)
  v_passport_code := public.generate_passport_code(calculated_animal);
  
  -- 5. Get animal and genius type IDs
  SELECT id INTO v_animal_type_id
  FROM public.animal_types
  WHERE LOWER(name) = LOWER(calculated_animal) OR LOWER(code) = LOWER(calculated_animal)
  LIMIT 1;
  
  IF v_animal_type_id IS NULL THEN
    INSERT INTO public.animal_types (code, name, personality_type, genius_type)
    VALUES (LOWER(calculated_animal), calculated_animal, calculated_animal, calculated_genius)
    RETURNING id INTO v_animal_type_id;
  END IF;
  
  SELECT id INTO v_genius_type_id
  FROM public.genius_types
  WHERE LOWER(name) = LOWER(calculated_genius) OR LOWER(code) = LOWER(calculated_genius)
  LIMIT 1;
  
  IF v_genius_type_id IS NULL THEN
    INSERT INTO public.genius_types (code, name, description)
    VALUES (LOWER(calculated_genius), calculated_genius, calculated_genius || ' genius type')
    RETURNING id INTO v_genius_type_id;
  END IF;
  
  -- 6. Create student record with pre-calculated MBTI type
  INSERT INTO public.students (
    class_id, user_id, student_name, grade_level, passport_code,
    personality_type, animal_type_id, genius_type_id, currency_balance,
    learning_style, school_year, created_at
  ) VALUES (
    v_class_id, p_user_id, v_student_name, grade, v_passport_code,
    calculated_mbti, v_animal_type_id, v_genius_type_id, v_starting_balance,
    calculated_learning_style, EXTRACT(YEAR FROM CURRENT_DATE), NOW()
  ) RETURNING id INTO v_student_id;
  
  -- 7. Create quiz_submission record with pre-calculated results
  INSERT INTO public.quiz_submissions (
    student_id, animal_type_id, genius_type_id, 
    answers, coins_earned, completed_at, created_at
  ) VALUES (
    v_student_id, v_animal_type_id, v_genius_type_id,
    quiz_answers::jsonb, v_starting_balance, NOW(), NOW()
  ) RETURNING id INTO v_submission_id;
  
  -- 8. Update student count
  UPDATE public.classes 
  SET number_of_students = COALESCE(number_of_students, 0) + 1
  WHERE id = v_class_id;
  
  -- 9. Log currency transaction
  INSERT INTO public.currency_transactions (
    student_id, amount, transaction_type, description, created_at
  ) VALUES (
    v_student_id, v_starting_balance, 'quiz_reward', 'Quiz completion reward', NOW()
  );
  
  -- 10. Return success with all data (using pre-calculated values)
  RETURN jsonb_build_object(
    'success', true, 
    'student_id', v_student_id, 
    'submission_id', v_submission_id,
    'passport_code', v_passport_code,
    'animal_type', calculated_animal, 
    'animal_genius', calculated_genius,
    'mbti_type', calculated_mbti,
    'learning_style', calculated_learning_style,
    'first_name', first_name, 
    'currency_balance', v_starting_balance
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public, auth;

GRANT EXECUTE ON FUNCTION public.create_student_from_quiz_with_results TO anon, authenticated;