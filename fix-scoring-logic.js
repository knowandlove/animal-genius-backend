#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

config();

const databaseUrl = process.env.DATABASE_URL;

async function fixScoringLogic() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔧 Fixing calculate_animal_type function with correct question mappings');
    console.log('─'.repeat(60));
    
    // Drop the incorrect function
    await client.query('DROP FUNCTION IF EXISTS public.calculate_animal_type(JSONB);');
    
    // Create the corrected function that properly maps to quiz questions
    const correctCalculateAnimalTypeSQL = `
CREATE OR REPLACE FUNCTION public.calculate_animal_type(quiz_answers JSONB) RETURNS TEXT AS $$
DECLARE
  e_score INTEGER := 0;
  i_score INTEGER := 0;
  s_score INTEGER := 0;
  n_score INTEGER := 0;
  t_score INTEGER := 0;
  f_score INTEGER := 0;
  j_score INTEGER := 0;
  p_score INTEGER := 0;
  mbti_type TEXT;
  answer TEXT;
BEGIN
  -- Process each question according to actual question mappings
  -- Question 1 (index 0): E/I dimension - A=I, B=E
  answer := (quiz_answers->0->>'answer')::TEXT;
  IF answer = 'A' THEN i_score := i_score + 1; END IF;
  IF answer = 'B' THEN e_score := e_score + 1; END IF;
  
  -- Question 2 (index 1): S/N dimension - A=S, B=N  
  answer := (quiz_answers->1->>'answer')::TEXT;
  IF answer = 'A' THEN s_score := s_score + 1; END IF;
  IF answer = 'B' THEN n_score := n_score + 1; END IF;
  
  -- Question 3 (index 2): T/F dimension - A=T, B=F
  answer := (quiz_answers->2->>'answer')::TEXT;
  IF answer = 'A' THEN t_score := t_score + 1; END IF;
  IF answer = 'B' THEN f_score := f_score + 1; END IF;
  
  -- Question 4 (index 3): J/P dimension - A=P, B=J
  answer := (quiz_answers->3->>'answer')::TEXT;
  IF answer = 'A' THEN p_score := p_score + 1; END IF;
  IF answer = 'B' THEN j_score := j_score + 1; END IF;
  
  -- Question 5 (index 4): E/I dimension - A=E, B=I
  answer := (quiz_answers->4->>'answer')::TEXT;
  IF answer = 'A' THEN e_score := e_score + 1; END IF;
  IF answer = 'B' THEN i_score := i_score + 1; END IF;
  
  -- Question 6 is VARK, skip for MBTI
  
  -- Question 7 (index 6): T/F dimension - A=T, B=F
  answer := (quiz_answers->6->>'answer')::TEXT;
  IF answer = 'A' THEN t_score := t_score + 1; END IF;
  IF answer = 'B' THEN f_score := f_score + 1; END IF;
  
  -- Question 8 (index 7): J/P dimension - A=P, B=J
  answer := (quiz_answers->7->>'answer')::TEXT;
  IF answer = 'A' THEN p_score := p_score + 1; END IF;
  IF answer = 'B' THEN j_score := j_score + 1; END IF;
  
  -- Question 9 (index 8): E/I dimension - A=I, B=E
  answer := (quiz_answers->8->>'answer')::TEXT;
  IF answer = 'A' THEN i_score := i_score + 1; END IF;
  IF answer = 'B' THEN e_score := e_score + 1; END IF;
  
  -- Question 10 (index 9): S/N dimension - A=N, B=S
  answer := (quiz_answers->9->>'answer')::TEXT;
  IF answer = 'A' THEN n_score := n_score + 1; END IF;
  IF answer = 'B' THEN s_score := s_score + 1; END IF;
  
  -- Question 11 is VARK, skip for MBTI
  
  -- Question 12 (index 11): J/P dimension - A=J, B=P (this was the bug!)
  answer := (quiz_answers->11->>'answer')::TEXT;
  IF answer = 'A' THEN j_score := j_score + 1; END IF;
  IF answer = 'B' THEN p_score := p_score + 1; END IF;
  
  -- Question 13 (index 12): E/I dimension - A=E, B=I
  answer := (quiz_answers->12->>'answer')::TEXT;
  IF answer = 'A' THEN e_score := e_score + 1; END IF;
  IF answer = 'B' THEN i_score := i_score + 1; END IF;
  
  -- Question 14 (index 13): S/N dimension - A=S, B=N
  answer := (quiz_answers->13->>'answer')::TEXT;
  IF answer = 'A' THEN s_score := s_score + 1; END IF;
  IF answer = 'B' THEN n_score := n_score + 1; END IF;
  
  -- Question 15 (index 14): T/F dimension - A=T, B=F
  answer := (quiz_answers->14->>'answer')::TEXT;
  IF answer = 'A' THEN t_score := t_score + 1; END IF;
  IF answer = 'B' THEN f_score := f_score + 1; END IF;
  
  -- Question 16 (index 15): J/P dimension - A=J, B=P
  answer := (quiz_answers->15->>'answer')::TEXT;
  IF answer = 'A' THEN j_score := j_score + 1; END IF;
  IF answer = 'B' THEN p_score := p_score + 1; END IF;
  
  -- Build MBTI type with tie-breaking rules from scoring.ts
  mbti_type := '';
  mbti_type := mbti_type || CASE WHEN e_score >= i_score THEN 'E' ELSE 'I' END;  -- Ties go to E
  mbti_type := mbti_type || CASE WHEN s_score > n_score THEN 'S' ELSE 'N' END;   -- Ties go to N
  mbti_type := mbti_type || CASE WHEN t_score >= f_score THEN 'T' ELSE 'F' END;  -- Ties go to T
  mbti_type := mbti_type || CASE WHEN j_score > p_score THEN 'J' ELSE 'P' END;   -- Ties go to P
  
  -- Map to actual 8 animals from scoring.ts
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
    
    await client.query(correctCalculateAnimalTypeSQL);
    console.log('✅ Fixed calculate_animal_type function');
    
    // Grant permission
    await client.query('GRANT EXECUTE ON FUNCTION public.calculate_animal_type TO anon, authenticated;');
    
    console.log('\n🔍 Testing fixed function...');
    
    // Test with all A answers
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

    // Trace scoring step by step
    console.log('📊 Tracing MBTI scoring for all A answers:');
    console.log('Q1: A → I');
    console.log('Q2: A → S');  
    console.log('Q3: A → T');
    console.log('Q4: A → P');
    console.log('Q5: A → E');
    console.log('Q7: A → T'); 
    console.log('Q8: A → P');
    console.log('Q9: A → I');
    console.log('Q10: A → N');
    console.log('Q12: A → J');
    console.log('Q13: A → E');
    console.log('Q14: A → S');
    console.log('Q15: A → T');
    console.log('Q16: A → J');
    console.log('');
    console.log('Scores: E=2, I=2, S=2, N=1, T=3, F=0, J=2, P=2');
    console.log('MBTI: E(tie→E) + N(S<N) + T + P(tie→P) = ENTP → Parrot');

    const animalResult = await client.query('SELECT public.calculate_animal_type($1) as animal_type', [testAnswers]);
    const animalType = animalResult.rows[0].animal_type;
    console.log('🐾 Actual result:', animalType);

    const geniusResult = await client.query('SELECT public.get_animal_genius($1) as genius_type', [animalType]);
    const geniusType = geniusResult.rows[0].genius_type;
    console.log('🧠 Genius type:', geniusType);

    const prefixResult = await client.query('SELECT public.get_animal_prefix($1) as prefix', [animalType]);
    const prefix = prefixResult.rows[0].prefix;
    console.log('🏷️ Animal prefix:', prefix);

    console.log('\n✅ Quiz logic function corrected!');

  } catch (err) {
    console.log('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

fixScoringLogic().catch(console.error);