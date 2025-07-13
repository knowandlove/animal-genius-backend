#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Applying currency transaction type fix');

async function applyFix() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    const { data, error } = await adminClient.rpc('sql', {
      query: `
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
          v_passport_code TEXT;
          v_animal_type TEXT;
          v_animal_genius TEXT;
          v_score DECIMAL;
          v_student_name TEXT;
          v_student_count INTEGER;
          v_animal_type_id UUID;
          v_genius_type_id UUID;
          v_starting_balance INTEGER := 50;
        BEGIN
          -- Wait for user replication
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

          -- Validate class
          SELECT id, seat_limit INTO v_class_id, v_seat_limit
          FROM public.classes 
          WHERE UPPER(class_code) = UPPER(p_class_code)
            AND (expires_at IS NULL OR expires_at > NOW())
            AND is_active = true;
            
          IF NOT FOUND THEN
            RAISE EXCEPTION 'INVALID_CLASS_CODE: Class code % not found or expired', p_class_code;
          END IF;
          
          v_student_name := first_name || ' ' || last_initial;
          v_animal_type := public.calculate_animal_type(quiz_answers);
          v_animal_genius := public.get_animal_genius(v_animal_type);
          v_passport_code := public.generate_passport_code(v_animal_type);
          
          -- Get type IDs
          SELECT id INTO v_animal_type_id FROM public.animal_types WHERE LOWER(name) = LOWER(v_animal_type) LIMIT 1;
          IF v_animal_type_id IS NULL THEN
            INSERT INTO public.animal_types (code, name, personality_type, genius_type)
            VALUES (LOWER(v_animal_type), v_animal_type, v_animal_type, v_animal_genius)
            RETURNING id INTO v_animal_type_id;
          END IF;
          
          SELECT id INTO v_genius_type_id FROM public.genius_types WHERE LOWER(name) = LOWER(v_animal_genius) LIMIT 1;
          IF v_genius_type_id IS NULL THEN
            INSERT INTO public.genius_types (code, name, description)
            VALUES (LOWER(v_animal_genius), v_animal_genius, v_animal_genius || ' genius type')
            RETURNING id INTO v_genius_type_id;
          END IF;
          
          -- Create student
          INSERT INTO public.students (
            class_id, user_id, student_name, grade_level, passport_code,
            personality_type, animal_type_id, genius_type_id, currency_balance,
            learning_style, school_year, created_at
          ) VALUES (
            v_class_id, p_user_id, v_student_name, grade, v_passport_code,
            v_animal_type, v_animal_type_id, v_genius_type_id, v_starting_balance,
            'visual', EXTRACT(YEAR FROM CURRENT_DATE), NOW()
          ) RETURNING id INTO v_student_id;
          
          UPDATE public.classes SET number_of_students = COALESCE(number_of_students, 0) + 1 WHERE id = v_class_id;
          
          -- FIXED: Use 'quiz_reward' instead of other types
          INSERT INTO public.currency_transactions (
            student_id, amount, transaction_type, description, created_at
          ) VALUES (
            v_student_id, v_starting_balance, 'quiz_reward', 'Quiz completion reward', NOW()
          );
          
          RETURN jsonb_build_object(
            'success', true, 'student_id', v_student_id, 'passport_code', v_passport_code,
            'animal_type', v_animal_type, 'animal_genius', v_animal_genius,
            'first_name', first_name, 'currency_balance', v_starting_balance
          );
        EXCEPTION
          WHEN OTHERS THEN
            RAISE;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public, auth;
      `
    });

    if (error) {
      console.log('❌ Error applying fix:', error.message);
    } else {
      console.log('✅ Function updated successfully');
    }

  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
}

applyFix().catch(console.error);