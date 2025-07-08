#!/usr/bin/env tsx
/**
 * Test database structure and RLS policies
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testDatabaseStructure() {
  console.log('🔍 Testing Database Structure and Policies\n');
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    console.log('1. Checking if profiles table exists...');
    const { data: tablesData, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'profiles');
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('✅ Tables query result:', tablesData);
    }
    
    console.log('\n2. Checking RLS policies on profiles table...');
    const { data: rlsData, error: rlsError } = await supabaseAdmin.rpc('get_table_policies', {
      table_name: 'profiles'
    }).select();
    
    if (rlsError) {
      console.log('RLS query failed (expected):', rlsError.message);
      
      // Try alternative approach
      console.log('3. Trying to query pg_policies directly...');
      const { data: policiesData, error: policiesError } = await supabaseAdmin
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'profiles');
      
      if (policiesError) {
        console.log('Policies query also failed:', policiesError.message);
      } else {
        console.log('✅ Policies found:', policiesData);
      }
    } else {
      console.log('✅ RLS policies:', rlsData);
    }
    
    console.log('\n4. Testing direct table access with service role...');
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Direct profiles access error:', profilesError);
    } else {
      console.log('✅ Profiles accessible, count:', profilesData?.length || 0);
    }
    
    console.log('\n5. Checking auth.users table access...');
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('auth.users')
      .select('id, email')
      .limit(1);
    
    if (usersError) {
      console.error('❌ Auth users access error:', usersError);
    } else {
      console.log('✅ Auth users accessible, count:', usersData?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testDatabaseStructure();