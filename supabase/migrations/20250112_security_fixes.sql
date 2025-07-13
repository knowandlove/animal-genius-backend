-- Critical security fixes for anonymous authentication system
-- Based on Gemini code review

-- 1. Make passport_code UNIQUE to prevent account takeover
DROP INDEX IF EXISTS idx_students_passport_code;
CREATE UNIQUE INDEX idx_students_passport_code ON students(passport_code);

-- 2. Fix generate_passport_code function to remove weak fallback
CREATE OR REPLACE FUNCTION generate_passport_code(animal_type TEXT DEFAULT NULL) 
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_suffix TEXT;
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars
  v_attempt INTEGER := 0;
  v_max_attempts INTEGER := 50;
BEGIN
  -- Get animal prefix
  v_prefix := CASE 
    WHEN animal_type = 'meerkat' THEN 'MEE'
    WHEN animal_type = 'panda' THEN 'PAN'
    WHEN animal_type = 'owl' THEN 'OWL'
    WHEN animal_type = 'beaver' THEN 'BEA'
    WHEN animal_type = 'elephant' THEN 'ELE'
    WHEN animal_type = 'otter' THEN 'OTT'
    WHEN animal_type = 'parrot' THEN 'PAR'
    WHEN animal_type = 'border_collie' THEN 'COL'
    ELSE 'STU' -- Default student prefix
  END;
  
  LOOP
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
    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate a unique passport code after % attempts for animal type %', v_max_attempts, animal_type;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Add search_path to SECURITY DEFINER functions
-- Fix submit_quiz_atomic
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
  -- Check if class exists and is active with explicit locking
  SELECT c.id, c.seat_limit INTO v_class_id, v_seat_limit
  FROM classes c
  WHERE UPPER(c.class_code) = UPPER(submit_quiz_atomic.class_code)
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > NOW())
  FOR UPDATE;
    
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
  v_passport_code := generate_passport_code(v_animal_type);
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Fix validate_student_login with optimized return and search_path
CREATE OR REPLACE FUNCTION validate_student_login(p_passport_code TEXT) 
RETURNS TABLE (
  student_id UUID,
  user_id UUID,
  class_id UUID,
  student_name TEXT,
  school_year TEXT,
  animal_type_code TEXT,
  genius_type_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.class_id,
    s.student_name::TEXT,
    s.school_year::TEXT,
    COALESCE(at.code, s.animal_type)::TEXT,
    COALESCE(gt.code, 'creative')::TEXT
  FROM students s
  LEFT JOIN animal_types at ON s.animal_type_id = at.id
  LEFT JOIN genius_types gt ON s.genius_type_id = gt.id
  WHERE s.passport_code = p_passport_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Add check constraint to ensure passport codes follow the correct format
ALTER TABLE students 
ADD CONSTRAINT chk_passport_code_format 
CHECK (passport_code ~ '^[A-Z]{3}-[A-Z0-9]{3}$');

-- Create a trigger to automatically uppercase passport codes on insert/update
CREATE OR REPLACE FUNCTION uppercase_passport_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.passport_code := UPPER(NEW.passport_code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_uppercase_passport_code
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION uppercase_passport_code();