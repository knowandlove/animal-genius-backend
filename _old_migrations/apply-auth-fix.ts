#!/usr/bin/env tsx
/**
 * Apply the auth trigger fix to the database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyAuthFix() {
  console.log('🔧 Applying Auth Trigger Fix\n');
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Read the SQL fix file
    const sqlFix = readFileSync('fix-auth-triggers.sql', 'utf8');
    
    console.log('Applying SQL fix...');
    
    // Split the SQL into individual statements
    const statements = sqlFix
      .split('--')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith(' '))
      .join('')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;
      
      console.log(`\nExecuting statement ${i + 1}:`);
      console.log(statement.substring(0, 100) + '...');
      
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', {
          sql: statement
        });
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} failed:`, error.message);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.log(`❌ Statement ${i + 1} error:`, err);
      }
    }
    
    console.log('\n🧪 Testing the fix...');
    
    // Test the fix by trying to create a user
    const testEmail = `fix-test-${Date.now()}@example.com`;
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'TestPass123!',
      user_metadata: {
        first_name: 'Fix',
        last_name: 'Test'
      }
    });
    
    if (error) {
      console.error('❌ Fix test failed:', error);
    } else {
      console.log('✅ Fix test successful! User created:', data.user?.id);
      
      // Check if profile was created
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single();
      
      if (profileError) {
        console.error('❌ Profile not found:', profileError);
      } else {
        console.log('✅ Profile created successfully:', profileData.email);
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyAuthFix();