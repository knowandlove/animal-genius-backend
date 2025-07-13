-- Anonymous Authentication System - Final Implementation
-- This adds all necessary columns and functions for the anonymous student auth system

-- 1. Add new columns to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS seat_limit INTEGER,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- 2. Add new columns to students table
ALTER TABLE students
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS school_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
ADD COLUMN IF NOT EXISTS quiz_score DECIMAL(5,2);

-- 3. Add is_anonymous flag to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false NOT NULL;

-- 4. Create function to calculate animal type from quiz answers
CREATE OR REPLACE FUNCTION calculate_animal_type(quiz_answers JSONB) RETURNS TEXT AS $$
DECLARE
  e_score INTEGER := 0;
  s_score INTEGER := 0;
  t_score INTEGER := 0;
  j_score INTEGER := 0;
  mbti_type TEXT;
BEGIN
  -- E/I dimension (questions 1-4)
  IF (quiz_answers->0->>'answer')::TEXT = 'a' THEN e_score := e_score + 1; END IF;
  IF (quiz_answers->1->>'answer')::TEXT = 'a' THEN e_score := e_score + 1; END IF;
  IF (quiz_answers->2->>'answer')::TEXT = 'a' THEN e_score := e_score + 1; END IF;
  IF (quiz_answers->3->>'answer')::TEXT = 'a' THEN e_score := e_score + 1; END IF;
  
  -- S/N dimension (questions 5-8)
  IF (quiz_answers->4->>'answer')::TEXT = 'a' THEN s_score := s_score + 1; END IF;
  IF (quiz_answers->5->>'answer')::TEXT = 'a' THEN s_score := s_score + 1; END IF;
  IF (quiz_answers->6->>'answer')::TEXT = 'a' THEN s_score := s_score + 1; END IF;
  IF (quiz_answers->7->>'answer')::TEXT = 'a' THEN s_score := s_score + 1; END IF;
  
  -- T/F dimension (questions 9-12)
  IF (quiz_answers->8->>'answer')::TEXT = 'a' THEN t_score := t_score + 1; END IF;
  IF (quiz_answers->9->>'answer')::TEXT = 'a' THEN t_score := t_score + 1; END IF;
  IF (quiz_answers->10->>'answer')::TEXT = 'a' THEN t_score := t_score + 1; END IF;
  IF (quiz_answers->11->>'answer')::TEXT = 'a' THEN t_score := t_score + 1; END IF;
  
  -- J/P dimension (questions 13-16)
  IF (quiz_answers->12->>'answer')::TEXT = 'a' THEN j_score := j_score + 1; END IF;
  IF (quiz_answers->13->>'answer')::TEXT = 'a' THEN j_score := j_score + 1; END IF;
  IF (quiz_answers->14->>'answer')::TEXT = 'a' THEN j_score := j_score + 1; END IF;
  IF (quiz_answers->15->>'answer')::TEXT = 'a' THEN j_score := j_score + 1; END IF;
  
  -- Build MBTI type
  mbti_type := '';
  mbti_type := mbti_type || CASE WHEN e_score >= 2 THEN 'E' ELSE 'I' END;
  mbti_type := mbti_type || CASE WHEN s_score >= 2 THEN 'S' ELSE 'N' END;
  mbti_type := mbti_type || CASE WHEN t_score >= 2 THEN 'T' ELSE 'F' END;
  mbti_type := mbti_type || CASE WHEN j_score >= 2 THEN 'J' ELSE 'P' END;
  
  -- Map to animal types
  RETURN CASE mbti_type
    WHEN 'INTJ' THEN 'owl'
    WHEN 'INTP' THEN 'owl'
    WHEN 'ENTJ' THEN 'eagle'
    WHEN 'ENTP' THEN 'octopus'
    WHEN 'INFJ' THEN 'whale'
    WHEN 'INFP' THEN 'unicorn'
    WHEN 'ENFJ' THEN 'elephant'
    WHEN 'ENFP' THEN 'dolphin'
    WHEN 'ISTJ' THEN 'beaver'
    WHEN 'ISFJ' THEN 'koala'
    WHEN 'ESTJ' THEN 'border_collie'
    WHEN 'ESFJ' THEN 'golden_retriever'
    WHEN 'ISTP' THEN 'cat'
    WHEN 'ISFP' THEN 'sloth'
    WHEN 'ESTP' THEN 'cheetah'
    WHEN 'ESFP' THEN 'meerkat'
    ELSE 'owl' -- default
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create function to calculate quiz score
CREATE OR REPLACE FUNCTION calculate_score(quiz_answers JSONB) RETURNS DECIMAL AS $$
BEGIN
  -- For now, return a simple percentage based on completion
  -- You can enhance this later with actual scoring logic
  RETURN (jsonb_array_length(quiz_answers)::DECIMAL / 16.0) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Create function to get animal prefix for passport codes
CREATE OR REPLACE FUNCTION get_animal_prefix(animal_type TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN CASE animal_type
    WHEN 'owl' THEN 'OWL'
    WHEN 'eagle' THEN 'EGL'
    WHEN 'octopus' THEN 'OCT'
    WHEN 'whale' THEN 'WHL'
    WHEN 'unicorn' THEN 'UNI'
    WHEN 'elephant' THEN 'ELE'
    WHEN 'dolphin' THEN 'DOL'
    WHEN 'beaver' THEN 'BVR'
    WHEN 'koala' THEN 'KOA'
    WHEN 'border_collie' THEN 'COL'
    WHEN 'golden_retriever' THEN 'GOL'
    WHEN 'cat' THEN 'CAT'
    WHEN 'sloth' THEN 'SLO'
    WHEN 'cheetah' THEN 'CHE'
    WHEN 'meerkat' THEN 'MKT'
    ELSE UPPER(SUBSTR(animal_type, 1, 3))
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Create passport code generation function
CREATE OR REPLACE FUNCTION generate_passport_code(animal_type TEXT) RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_suffix TEXT := '';
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempt INTEGER := 0;
  v_code TEXT;
BEGIN
  v_prefix := get_animal_prefix(animal_type);
  
  -- Try up to 10 times to generate a unique code
  WHILE v_attempt < 10 LOOP
    -- Generate 3 random characters
    v_suffix := '';
    FOR i IN 1..3 LOOP
      v_suffix := v_suffix || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    
    v_code := v_prefix || '-' || v_suffix;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM students WHERE passport_code = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_attempt := v_attempt + 1;
  END LOOP;
  
  -- If we couldn't generate a unique code, add timestamp
  RETURN v_prefix || '-' || SUBSTR(MD5(RANDOM()::TEXT || NOW()::TEXT), 1, 3);
END;
$$ LANGUAGE plpgsql;

-- 8. Create the main atomic quiz submission function
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
    RAISE EXCEPTION 'INVALID_CLASS_CODE: Class code % not found or expired', p_class_code;
  END IF;
  
  -- 2. Check seat limit
  SELECT COUNT(*) INTO v_student_count
  FROM students
  WHERE class_id = v_class_id;
  
  IF v_seat_limit IS NOT NULL AND v_student_count >= v_seat_limit THEN
    RAISE EXCEPTION 'CLASS_FULL: Class has reached capacity of % students', v_seat_limit;
  END IF;
  
  -- 3. Check for name collision
  v_student_name := first_name || ' ' || last_initial;
  
  IF EXISTS (
    SELECT 1 FROM students 
    WHERE class_id = v_class_id 
    AND student_name = v_student_name
  ) THEN
    RAISE EXCEPTION 'NAME_TAKEN: Student name % already exists in this class', v_student_name;
  END IF;
  
  -- 4. Calculate quiz results
  v_animal_type := calculate_animal_type(quiz_answers);
  v_passport_code := generate_passport_code(v_animal_type);
  
  -- Calculate MBTI type for storage
  v_mbti_type := jsonb_build_object(
    'E', quiz_answers->0->>'answer',
    'S', quiz_answers->4->>'answer', 
    'T', quiz_answers->8->>'answer',
    'J', quiz_answers->12->>'answer'
  )::TEXT;
  
  -- Calculate score
  v_score := calculate_score(quiz_answers);
  
  -- 5. Get animal and genius type IDs
  SELECT id INTO v_animal_type_id
  FROM animal_types
  WHERE LOWER(code) = LOWER(v_animal_type)
  LIMIT 1;
  
  -- Map to genius type
  SELECT id INTO v_genius_type_id
  FROM genius_types
  WHERE code = CASE 
    WHEN v_animal_type IN ('owl', 'beaver') THEN 'analytical'
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
  
  -- 10. Return success with student info
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to validate student login
CREATE OR REPLACE FUNCTION validate_student_login(p_passport_code TEXT) 
RETURNS TABLE (
  student_id UUID,
  user_id UUID,
  class_id UUID,
  student_name TEXT,
  animal_type_id UUID,
  genius_type_id UUID,
  school_year INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.class_id,
    s.student_name,
    s.animal_type_id,
    s.genius_type_id,
    s.school_year
  FROM students s
  WHERE s.passport_code = p_passport_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION submit_quiz_atomic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_student_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_passport_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_animal_type TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_score TO anon, authenticated;

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_passport_code ON students(passport_code);
CREATE INDEX IF NOT EXISTS idx_students_school_year ON students(school_year);
CREATE INDEX IF NOT EXISTS idx_classes_class_code ON classes(class_code);
CREATE INDEX IF NOT EXISTS idx_classes_expires_at ON classes(expires_at);
CREATE INDEX IF NOT EXISTS idx_classes_is_active ON classes(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_is_anonymous ON profiles(is_anonymous);

-- 12. Add RLS policies for student access
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Students can read their own data
CREATE POLICY "Students can read own data" ON students
  FOR SELECT
  USING (auth.uid() = user_id);

-- Students can read their class
CREATE POLICY "Students can read their class" ON classes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students 
      WHERE students.class_id = classes.id 
      AND students.user_id = auth.uid()
    )
  );

-- Anonymous users can execute quiz functions
CREATE POLICY "Anonymous can submit quiz" ON students
  FOR INSERT
  WITH CHECK (true);

-- Success! The anonymous auth system is ready.