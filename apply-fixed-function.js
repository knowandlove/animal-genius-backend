#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'fs';

config();

const databaseUrl = process.env.DATABASE_URL;

async function applyFixedFunction() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔧 Applying fixed create_student_from_quiz function');
    console.log('─'.repeat(50));
    
    // Read the migration file
    const migrationSQL = readFileSync('./supabase/migrations/20250712_fix_quiz_submission_creation.sql', 'utf8');
    
    console.log('📄 Read migration file successfully');
    
    // Apply the migration
    await client.query(migrationSQL);
    
    console.log('✅ Fixed function applied successfully!');
    console.log('\n🎯 Key changes made:');
    console.log('   • Now creates BOTH student AND quiz_submission records');
    console.log('   • Stores MBTI type (e.g., "ENFP") in personality_type field');
    console.log('   • Calculates learning_style from VARK questions');
    console.log('   • Uses atomic transaction for data integrity');
    console.log('   • Analytics dashboard should now work correctly');
    
  } catch (error) {
    console.log('❌ Error applying function:', error.message);
  } finally {
    await client.end();
  }
}

applyFixedFunction().catch(console.error);