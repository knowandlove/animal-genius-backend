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

-- 3. Update submit_quiz_atomic to use search_path and remove quiz_score
-- Note: This uses the version from phase1_stop_quiz_score_writes.sql
-- Just adding the search_path for security
UPDATE pg_proc 
SET prosecdef = true, 
    proconfig = ARRAY['search_path=pg_catalog, public']
WHERE proname = 'submit_quiz_atomic';

-- 4. Fix validate_student_login with search_path (already optimized)
UPDATE pg_proc 
SET prosecdef = true, 
    proconfig = ARRAY['search_path=pg_catalog, public']
WHERE proname = 'validate_student_login';

-- 5. Add check constraint to ensure passport codes follow the correct format
ALTER TABLE students 
ADD CONSTRAINT chk_passport_code_format 
CHECK (passport_code ~ '^[A-Z]{3}-[A-Z0-9]{3}$');

-- 6. Create a trigger to automatically uppercase passport codes on insert/update
CREATE OR REPLACE FUNCTION uppercase_passport_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.passport_code := UPPER(NEW.passport_code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_uppercase_passport_code ON students;
CREATE TRIGGER trg_uppercase_passport_code
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION uppercase_passport_code();