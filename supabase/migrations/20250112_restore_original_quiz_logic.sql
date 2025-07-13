-- Restore the original Animal Genius quiz logic
-- This fixes the broken MBTI-to-animal mapping that was corrupted during debugging

-- Drop broken functions
DROP FUNCTION IF EXISTS public.calculate_animal_type(JSONB);
DROP FUNCTION IF EXISTS public.calculate_score(JSONB);
DROP FUNCTION IF EXISTS public.get_animal_prefix(TEXT);
DROP FUNCTION IF EXISTS public.generate_passport_code(TEXT);

-- 1. Create correct MBTI to Animal mapping function (your original 8 animals)
CREATE OR REPLACE FUNCTION public.calculate_animal_type(quiz_answers JSONB) RETURNS TEXT AS $$
DECLARE
  e_score INTEGER := 0;
  s_score INTEGER := 0;
  t_score INTEGER := 0;
  j_score INTEGER := 0;
  mbti_type TEXT;
BEGIN
  -- E/I dimension (questions 1-4: id 0-3 in array)
  IF (quiz_answers->0->>'answer')::TEXT = 'B' THEN e_score := e_score + 1; END IF;
  IF (quiz_answers->1->>'answer')::TEXT = 'A' THEN e_score := e_score + 1; END IF;
  IF (quiz_answers->2->>'answer')::TEXT = 'A' THEN e_score := e_score + 1; END IF;
  IF (quiz_answers->3->>'answer')::TEXT = 'A' THEN e_score := e_score + 1; END IF;
  
  -- S/N dimension (questions 5-8: id 4-7 in array)
  IF (quiz_answers->4->>'answer')::TEXT = 'A' THEN s_score := s_score + 1; END IF;
  IF (quiz_answers->5->>'answer')::TEXT = 'B' THEN s_score := s_score + 1; END IF;
  IF (quiz_answers->6->>'answer')::TEXT = 'A' THEN s_score := s_score + 1; END IF;
  IF (quiz_answers->7->>'answer')::TEXT = 'B' THEN s_score := s_score + 1; END IF;
  
  -- T/F dimension (questions 9-12: id 8-11 in array)
  IF (quiz_answers->8->>'answer')::TEXT = 'A' THEN t_score := t_score + 1; END IF;
  IF (quiz_answers->9->>'answer')::TEXT = 'A' THEN t_score := t_score + 1; END IF;
  IF (quiz_answers->10->>'answer')::TEXT = 'B' THEN t_score := t_score + 1; END IF;
  IF (quiz_answers->11->>'answer')::TEXT = 'A' THEN t_score := t_score + 1; END IF;
  
  -- J/P dimension (questions 13-16: id 12-15 in array)
  IF (quiz_answers->12->>'answer')::TEXT = 'A' THEN j_score := j_score + 1; END IF;
  IF (quiz_answers->13->>'answer')::TEXT = 'A' THEN j_score := j_score + 1; END IF;
  IF (quiz_answers->14->>'answer')::TEXT = 'A' THEN j_score := j_score + 1; END IF;
  IF (quiz_answers->15->>'answer')::TEXT = 'A' THEN j_score := j_score + 1; END IF;
  
  -- Build MBTI type (ties handled as specified in scoring.ts)
  mbti_type := '';
  mbti_type := mbti_type || CASE WHEN e_score >= 2 THEN 'E' ELSE 'I' END;  -- Ties go to E
  mbti_type := mbti_type || CASE WHEN s_score > 2 THEN 'S' ELSE 'N' END;   -- Ties go to N
  mbti_type := mbti_type || CASE WHEN t_score >= 2 THEN 'T' ELSE 'F' END;  -- Ties go to T
  mbti_type := mbti_type || CASE WHEN j_score > 2 THEN 'J' ELSE 'P' END;   -- Ties go to P
  
  -- Map to YOUR ACTUAL 8 animals (from scoring.ts)
  RETURN CASE mbti_type
    WHEN 'INFP' THEN 'Meerkat'
    WHEN 'ISFP' THEN 'Meerkat'
    WHEN 'INFJ' THEN 'Panda'
    WHEN 'INTJ' THEN 'Panda'
    WHEN 'ISTP' THEN 'Owl'
    WHEN 'INTP' THEN 'Owl'
    WHEN 'ISFJ' THEN 'Beaver'
    WHEN 'ISTJ' THEN 'Beaver'
    WHEN 'ESFJ' THEN 'Elephant'
    WHEN 'ENFJ' THEN 'Elephant'
    WHEN 'ESFP' THEN 'Otter'
    WHEN 'ESTP' THEN 'Otter'
    WHEN 'ENFP' THEN 'Parrot'
    WHEN 'ENTP' THEN 'Parrot'
    WHEN 'ESTJ' THEN 'Border Collie'
    WHEN 'ENTJ' THEN 'Border Collie'
    ELSE 'Owl' -- default fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Create function to get animal genius type (your 3 types: Thinker, Feeler, Doer)
CREATE OR REPLACE FUNCTION public.get_animal_genius(animal_type TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN CASE animal_type
    WHEN 'Owl' THEN 'Thinker'
    WHEN 'Parrot' THEN 'Thinker'
    WHEN 'Meerkat' THEN 'Feeler'
    WHEN 'Elephant' THEN 'Feeler'
    WHEN 'Panda' THEN 'Feeler'
    WHEN 'Beaver' THEN 'Doer'
    WHEN 'Otter' THEN 'Doer'
    WHEN 'Border Collie' THEN 'Doer'
    ELSE 'Thinker' -- default fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Create function to calculate quiz score
CREATE OR REPLACE FUNCTION public.calculate_score(quiz_answers JSONB) RETURNS DECIMAL AS $$
BEGIN
  -- Simple completion percentage for now
  RETURN (jsonb_array_length(quiz_answers)::DECIMAL / 16.0) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Create function to get animal prefix for passport codes
CREATE OR REPLACE FUNCTION public.get_animal_prefix(animal_type TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN CASE animal_type
    WHEN 'Meerkat' THEN 'MKT'
    WHEN 'Panda' THEN 'PAN'
    WHEN 'Owl' THEN 'OWL'
    WHEN 'Beaver' THEN 'BVR'
    WHEN 'Elephant' THEN 'ELE'
    WHEN 'Otter' THEN 'OTT'
    WHEN 'Parrot' THEN 'PAR'
    WHEN 'Border Collie' THEN 'COL'
    ELSE UPPER(SUBSTR(animal_type, 1, 3))
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create passport code generation function
CREATE OR REPLACE FUNCTION public.generate_passport_code(animal_type TEXT) RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_suffix TEXT;
  v_passport_code TEXT;
  v_attempt INTEGER := 0;
BEGIN
  v_prefix := public.get_animal_prefix(animal_type);
  
  LOOP
    -- Generate random 3-character suffix
    v_suffix := UPPER(
      CHR(65 + (RANDOM() * 25)::INTEGER) ||
      CHR(65 + (RANDOM() * 25)::INTEGER) ||
      (RANDOM() * 9)::INTEGER::TEXT
    );
    
    v_passport_code := v_prefix || '-' || v_suffix;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE passport_code = v_passport_code) THEN
      RETURN v_passport_code;
    END IF;
    
    v_attempt := v_attempt + 1;
    IF v_attempt > 100 THEN
      -- Fallback to timestamp-based code
      v_suffix := EXTRACT(EPOCH FROM NOW())::TEXT;
      v_passport_code := v_prefix || '-' || SUBSTR(v_suffix, -3);
      RETURN v_passport_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_animal_type TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_animal_genius TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_score TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_animal_prefix TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_passport_code TO anon, authenticated;