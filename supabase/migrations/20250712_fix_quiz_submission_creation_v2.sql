-- Fix create_student_from_quiz to create BOTH student AND quiz_submission records
-- Remove score column (not needed for personality quiz)

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
  v_submission_id UUID;
  v_passport_code TEXT;
  v_animal_type TEXT;
  v_animal_genius TEXT;
  v_mbti_type TEXT;
  v_learning_style TEXT;
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
  
  -- 4. Calculate quiz results using the working functions
  v_animal_type := public.calculate_animal_type(quiz_answers);
  v_animal_genius := public.get_animal_genius(v_animal_type);
  v_passport_code := public.generate_passport_code(v_animal_type);
  
  -- 5. Calculate MBTI type from animal type (reverse mapping)
  v_mbti_type := CASE v_animal_type
    WHEN 'Meerkat' THEN 'INFP'  -- Default to one of the Meerkat types
    WHEN 'Panda' THEN 'INFJ'    -- Default to one of the Panda types  
    WHEN 'Owl' THEN 'ISTP'      -- Default to one of the Owl types
    WHEN 'Beaver' THEN 'ISFJ'   -- Default to one of the Beaver types
    WHEN 'Elephant' THEN 'ESFJ' -- Default to one of the Elephant types
    WHEN 'Otter' THEN 'ESFP'    -- Default to one of the Otter types
    WHEN 'Parrot' THEN 'ENFP'   -- Default to one of the Parrot types
    WHEN 'Border Collie' THEN 'ESTJ' -- Default to one of the Border Collie types
    ELSE 'INTJ' -- fallback
  END;
  
  -- 6. Calculate learning style from VARK questions (questions 6, 11)
  DECLARE
    visual_count INTEGER := 0;
    auditory_count INTEGER := 0;
    kinesthetic_count INTEGER := 0;
    reading_count INTEGER := 0;
    answer_text TEXT;
  BEGIN
    -- Question 6 (index 5)
    answer_text := (quiz_answers->5->>'answer')::TEXT;
    IF answer_text = 'A' THEN visual_count := visual_count + 1;
    ELSIF answer_text = 'B' THEN auditory_count := auditory_count + 1;
    ELSIF answer_text = 'C' THEN reading_count := reading_count + 1;
    ELSIF answer_text = 'D' THEN kinesthetic_count := kinesthetic_count + 1;
    END IF;
    
    -- Question 11 (index 10)  
    answer_text := (quiz_answers->10->>'answer')::TEXT;
    IF answer_text = 'A' THEN visual_count := visual_count + 1;
    ELSIF answer_text = 'B' THEN auditory_count := auditory_count + 1;
    ELSIF answer_text = 'C' THEN reading_count := reading_count + 1;
    ELSIF answer_text = 'D' THEN kinesthetic_count := kinesthetic_count + 1;
    END IF;
    
    -- Determine primary learning style
    IF visual_count >= auditory_count AND visual_count >= kinesthetic_count AND visual_count >= reading_count THEN
      v_learning_style := 'visual';
    ELSIF auditory_count >= kinesthetic_count AND auditory_count >= reading_count THEN
      v_learning_style := 'auditory';
    ELSIF reading_count >= kinesthetic_count THEN
      v_learning_style := 'readingWriting';
    ELSE
      v_learning_style := 'kinesthetic';
    END IF;
  END;
  
  -- 7. Get animal and genius type IDs
  SELECT id INTO v_animal_type_id
  FROM public.animal_types
  WHERE LOWER(name) = LOWER(v_animal_type) OR LOWER(code) = LOWER(v_animal_type)
  LIMIT 1;
  
  IF v_animal_type_id IS NULL THEN
    INSERT INTO public.animal_types (code, name, personality_type, genius_type)
    VALUES (LOWER(v_animal_type), v_animal_type, v_animal_type, v_animal_genius)
    RETURNING id INTO v_animal_type_id;
  END IF;
  
  SELECT id INTO v_genius_type_id
  FROM public.genius_types
  WHERE LOWER(name) = LOWER(v_animal_genius) OR LOWER(code) = LOWER(v_animal_genius)
  LIMIT 1;
  
  IF v_genius_type_id IS NULL THEN
    INSERT INTO public.genius_types (code, name, description)
    VALUES (LOWER(v_animal_genius), v_animal_genius, v_animal_genius || ' genius type')
    RETURNING id INTO v_genius_type_id;
  END IF;
  
  -- 8. Create student record with MBTI type as personality_type
  INSERT INTO public.students (
    class_id, user_id, student_name, grade_level, passport_code,
    personality_type, animal_type_id, genius_type_id, currency_balance,
    learning_style, school_year, created_at
  ) VALUES (
    v_class_id, p_user_id, v_student_name, grade, v_passport_code,
    v_mbti_type, v_animal_type_id, v_genius_type_id, v_starting_balance,
    v_learning_style, EXTRACT(YEAR FROM CURRENT_DATE), NOW()
  ) RETURNING id INTO v_student_id;
  
  -- 9. **THE CRITICAL FIX**: Create quiz_submission record (no score needed)
  INSERT INTO public.quiz_submissions (
    student_id, animal_type_id, genius_type_id, 
    answers, coins_earned, completed_at, created_at
  ) VALUES (
    v_student_id, v_animal_type_id, v_genius_type_id,
    quiz_answers::jsonb, v_starting_balance, NOW(), NOW()
  ) RETURNING id INTO v_submission_id;
  
  -- 10. Update student count
  UPDATE public.classes 
  SET number_of_students = COALESCE(number_of_students, 0) + 1
  WHERE id = v_class_id;
  
  -- 11. Log currency transaction
  INSERT INTO public.currency_transactions (
    student_id, amount, transaction_type, description, created_at
  ) VALUES (
    v_student_id, v_starting_balance, 'quiz_reward', 'Quiz completion reward', NOW()
  );
  
  -- 12. Return success with all data
  RETURN jsonb_build_object(
    'success', true, 
    'student_id', v_student_id, 
    'submission_id', v_submission_id,
    'passport_code', v_passport_code,
    'animal_type', v_animal_type, 
    'animal_genius', v_animal_genius,
    'mbti_type', v_mbti_type,
    'learning_style', v_learning_style,
    'first_name', first_name, 
    'currency_balance', v_starting_balance
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public, auth;

GRANT EXECUTE ON FUNCTION public.create_student_from_quiz TO anon, authenticated;