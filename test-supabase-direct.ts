#!/usr/bin/env tsx
/**
 * Direct test of Supabase auth to isolate the issue
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testSupabaseAuth() {
  console.log('🔍 Testing Supabase Auth Directly\n');
  
  // Test with anon client (like the app does)
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  
  // Test with admin client
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  const testEmail = `test-${Date.now()}@example.com`;
  console.log('Test email:', testEmail);
  
  try {
    console.log('\n1. Testing with anon client (like the app)...');
    const { data: anonData, error: anonError } = await supabaseAnon.auth.signUp({
      email: testEmail,
      password: 'TestPass123!',
      options: {
        data: {
          first_name: 'Test',
          last_name: 'User'
        }
      }
    });
    
    if (anonError) {
      console.error('❌ Anon client error:', anonError);
      console.error('Full error:', JSON.stringify(anonError, null, 2));
    } else {
      console.log('✅ Anon client success:', anonData);
    }
    
    console.log('\n2. Testing with admin client...');
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: `admin-${Date.now()}@example.com`,
      password: 'TestPass123!',
      user_metadata: {
        first_name: 'Admin',
        last_name: 'Test'
      }
    });
    
    if (adminError) {
      console.error('❌ Admin client error:', adminError);
      console.error('Full error:', JSON.stringify(adminError, null, 2));
    } else {
      console.log('✅ Admin client success:', adminData);
    }
    
    console.log('\n3. Testing database connection...');
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (dbError) {
      console.error('❌ Database connection error:', dbError);
    } else {
      console.log('✅ Database connection successful');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testSupabaseAuth();