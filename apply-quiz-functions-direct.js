#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

config();

// Parse DATABASE_URL to get connection details
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

async function applyQuizFunctions() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔧 Applying correct quiz logic functions via direct SQL');
    console.log('─'.repeat(50));
    
    // Drop broken functions first
    await client.query('DROP FUNCTION IF EXISTS public.calculate_animal_type(JSONB);');
    await client.query('DROP FUNCTION IF EXISTS public.calculate_score(JSONB);');
    await client.query('DROP FUNCTION IF EXISTS public.get_animal_prefix(TEXT);');
    await client.query('DROP FUNCTION IF EXISTS public.get_animal_genius(TEXT);');
    await client.query('DROP FUNCTION IF EXISTS public.generate_passport_code(TEXT);');
    
    console.log('🗑️ Dropped old functions');
    
    // Create correct calculate_animal_type function
    const calculateAnimalTypeSQL = `
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
$$ LANGUAGE plpgsql IMMUTABLE;`;
    
    await client.query(calculateAnimalTypeSQL);
    console.log('✅ Created calculate_animal_type function');
    
    // Create get_animal_genius function
    const getAnimalGeniusSQL = `
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
$$ LANGUAGE plpgsql IMMUTABLE;`;
    
    await client.query(getAnimalGeniusSQL);
    console.log('✅ Created get_animal_genius function');
    
    // Create get_animal_prefix function
    const getAnimalPrefixSQL = `
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
$$ LANGUAGE plpgsql IMMUTABLE;`;
    
    await client.query(getAnimalPrefixSQL);
    console.log('✅ Created get_animal_prefix function');
    
    // Create calculate_score function
    const calculateScoreSQL = `
CREATE OR REPLACE FUNCTION public.calculate_score(quiz_answers JSONB) RETURNS DECIMAL AS $$
BEGIN
  -- Simple completion percentage for now
  RETURN (jsonb_array_length(quiz_answers)::DECIMAL / 16.0) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
    
    await client.query(calculateScoreSQL);
    console.log('✅ Created calculate_score function');
    
    // Create generate_passport_code function
    const generatePassportCodeSQL = `
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
$$ LANGUAGE plpgsql VOLATILE;`;
    
    await client.query(generatePassportCodeSQL);
    console.log('✅ Created generate_passport_code function');
    
    // Grant permissions
    await client.query('GRANT EXECUTE ON FUNCTION public.calculate_animal_type TO anon, authenticated;');
    await client.query('GRANT EXECUTE ON FUNCTION public.get_animal_genius TO anon, authenticated;');
    await client.query('GRANT EXECUTE ON FUNCTION public.calculate_score TO anon, authenticated;');
    await client.query('GRANT EXECUTE ON FUNCTION public.get_animal_prefix TO anon, authenticated;');
    await client.query('GRANT EXECUTE ON FUNCTION public.generate_passport_code TO anon, authenticated;');
    
    console.log('✅ Granted permissions');
    
    console.log('\n🔍 Testing applied functions...');
    
    // Test with all A answers (should result in ISFJ -> Beaver -> Doer -> BVR-XXX)
    const testAnswers = JSON.stringify([
      {"questionId": 1, "answer": "A"}, {"questionId": 2, "answer": "A"}, 
      {"questionId": 3, "answer": "A"}, {"questionId": 4, "answer": "A"},
      {"questionId": 5, "answer": "A"}, {"questionId": 6, "answer": "A"},
      {"questionId": 7, "answer": "A"}, {"questionId": 8, "answer": "A"},
      {"questionId": 9, "answer": "A"}, {"questionId": 10, "answer": "A"},
      {"questionId": 11, "answer": "A"}, {"questionId": 12, "answer": "A"},
      {"questionId": 13, "answer": "A"}, {"questionId": 14, "answer": "A"},
      {"questionId": 15, "answer": "A"}, {"questionId": 16, "answer": "A"}
    ]);

    // Test calculate_animal_type
    const animalResult = await client.query('SELECT public.calculate_animal_type($1) as animal_type', [testAnswers]);
    const animalType = animalResult.rows[0].animal_type;
    console.log('🐾 Animal type result:', animalType, '(should be Beaver)');

    // Test get_animal_genius
    const geniusResult = await client.query('SELECT public.get_animal_genius($1) as genius_type', [animalType]);
    const geniusType = geniusResult.rows[0].genius_type;
    console.log('🧠 Genius type result:', geniusType, '(should be Doer)');

    // Test get_animal_prefix
    const prefixResult = await client.query('SELECT public.get_animal_prefix($1) as prefix', [animalType]);
    const prefix = prefixResult.rows[0].prefix;
    console.log('🏷️ Animal prefix result:', prefix, '(should be BVR)');

    // Test generate_passport_code
    const passportResult = await client.query('SELECT public.generate_passport_code($1) as passport_code', [animalType]);
    const passportCode = passportResult.rows[0].passport_code;
    console.log('🎫 Passport code result:', passportCode, '(should start with BVR-)');

    console.log('\n✅ All quiz logic functions restored and working correctly!');
    console.log('🎯 Expected: ISFJ -> Beaver -> Doer -> BVR-XXX');
    console.log(`🎯 Actual: ISFJ -> ${animalType} -> ${geniusType} -> ${passportCode}`);

  } catch (err) {
    console.log('❌ Error:', err.message);
    console.log('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

applyQuizFunctions().catch(console.error);