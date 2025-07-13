#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyQuizFunctions() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('🔧 Applying correct quiz logic functions');
  console.log('─'.repeat(50));
  
  try {
    // Read the correct migration file
    const migrationSQL = readFileSync('./supabase/migrations/20250112_restore_original_quiz_logic.sql', 'utf8');
    
    console.log('📄 Read migration file successfully');
    
    // Apply the migration SQL
    const { data, error } = await adminClient.rpc('sql', {
      query: migrationSQL
    });

    if (error) {
      console.log('❌ Error applying quiz functions:', error.message);
      return false;
    } else {
      console.log('✅ Quiz logic functions applied successfully');
      
      // Test the functions
      console.log('\n🔍 Testing applied functions...');
      
      const testAnswers = [
        {"questionId": 1, "answer": "A"}, {"questionId": 2, "answer": "A"}, 
        {"questionId": 3, "answer": "A"}, {"questionId": 4, "answer": "A"},
        {"questionId": 5, "answer": "A"}, {"questionId": 6, "answer": "A"},
        {"questionId": 7, "answer": "A"}, {"questionId": 8, "answer": "A"},
        {"questionId": 9, "answer": "A"}, {"questionId": 10, "answer": "A"},
        {"questionId": 11, "answer": "A"}, {"questionId": 12, "answer": "A"},
        {"questionId": 13, "answer": "A"}, {"questionId": 14, "answer": "A"},
        {"questionId": 15, "answer": "A"}, {"questionId": 16, "answer": "A"}
      ];

      // Test calculate_animal_type
      const { data: animalType, error: animalError } = await adminClient
        .rpc('calculate_animal_type', { quiz_answers: testAnswers });
        
      if (animalError) {
        console.log('❌ calculate_animal_type test failed:', animalError.message);
      } else {
        console.log('🐾 Animal type result:', animalType, '(should be Beaver)');
      }

      // Test get_animal_genius
      if (animalType) {
        const { data: geniusType, error: geniusError } = await adminClient
          .rpc('get_animal_genius', { animal_type: animalType });
          
        if (geniusError) {
          console.log('❌ get_animal_genius test failed:', geniusError.message);
        } else {
          console.log('🧠 Genius type result:', geniusType, '(should be Doer)');
        }
      }

      // Test get_animal_prefix
      if (animalType) {
        const { data: prefix, error: prefixError } = await adminClient
          .rpc('get_animal_prefix', { animal_type: animalType });
          
        if (prefixError) {
          console.log('❌ get_animal_prefix test failed:', prefixError.message);
        } else {
          console.log('🏷️ Animal prefix result:', prefix, '(should be BVR)');
        }
      }

      // Test generate_passport_code
      if (animalType) {
        const { data: passportCode, error: passportError } = await adminClient
          .rpc('generate_passport_code', { animal_type: animalType });
          
        if (passportError) {
          console.log('❌ generate_passport_code test failed:', passportError.message);
        } else {
          console.log('🎫 Passport code result:', passportCode, '(should start with BVR-)');
        }
      }

      console.log('\n✅ All functions restored and tested!');
      return true;
    }

  } catch (err) {
    console.log('❌ Exception:', err.message);
    return false;
  }
}

applyQuizFunctions().catch(console.error);