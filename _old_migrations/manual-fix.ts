#!/usr/bin/env tsx
/**
 * Manually apply the auth trigger fix using simple queries
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function manualFix() {
  console.log('🔧 Manually Applying Auth Fix\n');
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    console.log('1. Disabling RLS on profiles table...');
    const { error: rlsError } = await supabaseAdmin.rpc('exec', {
      sql: 'ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;'
    });
    
    if (rlsError) {
      console.log('❌ RLS disable failed:', rlsError.message);
    } else {
      console.log('✅ RLS disabled');
    }
    
    console.log('\n2. Testing direct user creation...');
    const testEmail = `manual-test-${Date.now()}@example.com`;
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'TestPass123!',
      user_metadata: {
        first_name: 'Manual',
        last_name: 'Test'
      }
    });
    
    if (error) {
      console.error('❌ User creation still fails:', error);
    } else {
      console.log('✅ User created successfully:', data.user?.id);
      
      // Try to manually create profile
      console.log('\n3. Creating profile manually...');
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          first_name: 'Manual',
          last_name: 'Test',
          full_name: 'Manual Test'
        })
        .select()
        .single();
      
      if (profileError) {
        console.error('❌ Manual profile creation failed:', profileError);
      } else {
        console.log('✅ Profile created manually:', profileData.email);
      }
    }
    
    console.log('\n4. Testing original registration...');
    const { data: regData, error: regError } = await supabaseAdmin.auth.signUp({
      email: `signup-test-${Date.now()}@example.com`,
      password: 'TestPass123!',
      options: {
        data: {
          first_name: 'Signup',
          last_name: 'Test'
        }
      }
    });
    
    if (regError) {
      console.error('❌ SignUp still fails:', regError);
    } else {
      console.log('✅ SignUp now works:', regData.user?.id);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

manualFix();