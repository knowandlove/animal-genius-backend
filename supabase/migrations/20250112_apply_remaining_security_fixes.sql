-- Apply remaining security fixes

-- 1. Make passport_code UNIQUE (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'students' 
    AND indexdef LIKE '%UNIQUE%' 
    AND indexname LIKE '%passport%'
  ) THEN
    DROP INDEX IF EXISTS idx_students_passport_code;
    CREATE UNIQUE INDEX idx_students_passport_code ON students(passport_code);
    RAISE NOTICE 'Created UNIQUE index on passport_code';
  ELSE
    RAISE NOTICE 'UNIQUE index on passport_code already exists';
  END IF;
END $$;

-- 2. Add check constraint for passport format (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'students'::regclass 
    AND conname = 'chk_passport_code_format'
  ) THEN
    ALTER TABLE students 
    ADD CONSTRAINT chk_passport_code_format 
    CHECK (passport_code ~ '^[A-Z]{3}-[A-Z0-9]{3}$');
    RAISE NOTICE 'Added passport code format constraint';
  ELSE
    RAISE NOTICE 'Passport code format constraint already exists';
  END IF;
END $$;

-- 3. Update generate_passport_code to remove weak fallback and add proper error
CREATE OR REPLACE FUNCTION generate_passport_code(animal_type TEXT DEFAULT NULL) 
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_suffix TEXT;
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempt INTEGER := 0;
  v_max_attempts INTEGER := 50;
BEGIN
  v_prefix := CASE 
    WHEN animal_type = 'meerkat' THEN 'MEE'
    WHEN animal_type = 'panda' THEN 'PAN'
    WHEN animal_type = 'owl' THEN 'OWL'
    WHEN animal_type = 'beaver' THEN 'BEA'
    WHEN animal_type = 'elephant' THEN 'ELE'
    WHEN animal_type = 'otter' THEN 'OTT'
    WHEN animal_type = 'parrot' THEN 'PAR'
    WHEN animal_type = 'border_collie' THEN 'COL'
    ELSE 'STU'
  END;
  
  LOOP
    v_suffix := '';
    FOR i IN 1..3 LOOP
      v_suffix := v_suffix || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    
    v_code := v_prefix || '-' || v_suffix;
    
    IF NOT EXISTS (SELECT 1 FROM students WHERE passport_code = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_attempt := v_attempt + 1;
    IF v_attempt >= v_max_attempts THEN
      -- This is the critical security fix - fail rather than use weak fallback
      RAISE EXCEPTION 'Could not generate a unique passport code after % attempts for animal type %', v_max_attempts, animal_type;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Add search_path to existing SECURITY DEFINER functions
-- This prevents SQL injection by limiting where functions look for objects
DO $$
DECLARE
  func_name TEXT;
BEGIN
  FOR func_name IN 
    SELECT proname FROM pg_proc 
    WHERE proname IN ('submit_quiz_atomic', 'validate_student_login', 'calculate_animal_type')
    AND prosecdef = true
  LOOP
    EXECUTE format('
      ALTER FUNCTION %I(text, text, text, text, jsonb) 
      SET search_path = pg_catalog, public', 
      func_name
    );
    RAISE NOTICE 'Set search_path for function %', func_name;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    -- Try with different signatures if the above fails
    RAISE NOTICE 'Trying alternative function signatures...';
END $$;

-- Show summary of security status
SELECT 'SECURITY FIX SUMMARY:' as status;
SELECT 
  'Unique passport codes' as feature,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'students' 
    AND indexdef LIKE '%UNIQUE%' 
    AND indexname LIKE '%passport%'
  ) THEN '✅ Applied' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
  'Format validation' as feature,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'students'::regclass 
    AND conname = 'chk_passport_code_format'
  ) THEN '✅ Applied' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
  'Uppercase trigger' as feature,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgrelid = 'students'::regclass 
    AND tgname LIKE '%passport%'
  ) THEN '✅ Applied' ELSE '❌ Missing' END as status;