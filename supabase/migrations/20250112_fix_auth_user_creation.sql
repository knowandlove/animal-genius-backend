-- Migration to fix auth user creation issue
-- This updates submit_quiz_atomic to accept user_id parameter instead of creating auth users directly

-- Drop the existing function
DROP FUNCTION IF EXISTS submit_quiz_atomic(TEXT, TEXT, TEXT, TEXT, JSONB);

-- Recreate with user_id parameter
CREATE OR REPLACE FUNCTION submit_quiz_atomic(
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
  v_user_id UUID;
  v_passport_code TEXT;
  v_animal_type TEXT;
  v_mbti_type TEXT;
  v_score DECIMAL;
  v_student_name TEXT;
  v_student_count INTEGER;
  v_animal_type_id UUID;
  v_genius_type_id UUID;
BEGIN
  -- 1. Validate class exists and is active (using class_code column)
  SELECT id, seat_limit INTO v_class_id, v_seat_limit
  FROM classes 
  WHERE UPPER(class_code) = UPPER(p_class_code)
    AND (expires_at IS NULL OR expires_at > NOW())
    AND is_active = true;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class code "%" not found or is inactive', p_class_code;
  END IF;
  
  -- 2. Check class capacity
  SELECT COUNT(*) INTO v_student_count FROM students WHERE class_id = v_class_id;
  
  IF v_seat_limit > 0 AND v_student_count >= v_seat_limit THEN
    RAISE EXCEPTION 'Class "%" has reached its capacity of % students', p_class_code, v_seat_limit;
  END IF;
  
  -- 3. Validate student name uniqueness in class
  v_student_name := INITCAP(TRIM(first_name)) || ' ' || UPPER(TRIM(last_initial)) || '.';
  
  IF EXISTS (
    SELECT 1 FROM students 
    WHERE class_id = v_class_id 
    AND UPPER(student_name) = UPPER(v_student_name)
  ) THEN
    RAISE EXCEPTION 'Student name "%" already exists in class "%"', v_student_name, p_class_code;
  END IF;
  
  -- 4. Calculate MBTI type and score
  SELECT type, score INTO v_mbti_type, v_score
  FROM calculate_mbti_type(quiz_answers);
  
  -- 5. Get animal type based on MBTI
  v_animal_type := calculate_animal_type(v_mbti_type);
  
  -- Generate unique passport code
  v_passport_code := generate_passport_code(v_animal_type);
  
  -- Get animal_type_id from the animal type code
  SELECT id INTO v_animal_type_id
  FROM animal_types 
  WHERE code = v_animal_type;
  
  -- Get genius_type_id - assign based on animal type for now
  SELECT id INTO v_genius_type_id
  FROM genius_types 
  WHERE code = CASE 
    WHEN v_animal_type IN ('owl', 'elephant') THEN 'analytical'
    WHEN v_animal_type IN ('panda', 'otter') THEN 'social'
    WHEN v_animal_type IN ('meerkat', 'border_collie') THEN 'practical'
    WHEN v_animal_type IN ('octopus', 'dolphin') THEN 'creative'
    ELSE 'social'
  END
  LIMIT 1;
  
  -- 6. Use the provided user_id from the Edge Function
  v_user_id := p_user_id;
  
  -- 7. Create student record
  INSERT INTO students (
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
    v_mbti_type,
    v_animal_type_id,
    v_genius_type_id,
    v_score,
    EXTRACT(YEAR FROM CURRENT_DATE)
  ) RETURNING id INTO v_student_id;
  
  -- 8. Update student count in classes
  UPDATE classes 
  SET number_of_students = COALESCE(number_of_students, 0) + 1
  WHERE id = v_class_id;
  
  -- Return success with all relevant data
  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'passport_code', v_passport_code,
    'animal_type', v_animal_type,
    'mbti_type', v_mbti_type,
    'first_name', INITCAP(TRIM(first_name)),
    'score', v_score,
    'class_id', v_class_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Quiz submission failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';