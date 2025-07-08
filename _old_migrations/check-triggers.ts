#!/usr/bin/env tsx
/**
 * Check for database triggers and functions that might be causing the issue
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkTriggers() {
  console.log('🔍 Checking for Database Triggers and Functions\n');
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Check for triggers on auth.users table
    console.log('1. Checking triggers on auth.users...');
    const { data: triggersData, error: triggersError } = await supabaseAdmin.rpc('sql', {
      query: `
        SELECT 
          t.trigger_name,
          t.event_manipulation,
          t.action_statement,
          t.action_timing,
          t.event_object_table
        FROM information_schema.triggers t 
        WHERE t.event_object_schema = 'auth' 
        AND t.event_object_table = 'users';
      `
    });
    
    if (triggersError) {
      console.log('❌ Triggers query failed:', triggersError.message);
    } else {
      console.log('✅ Triggers on auth.users:', triggersData);
    }
    
    // Check for functions that might be related to profiles
    console.log('\n2. Checking functions related to profiles...');
    const { data: functionsData, error: functionsError } = await supabaseAdmin.rpc('sql', {
      query: `
        SELECT 
          p.proname as function_name,
          n.nspname as schema_name,
          pg_get_function_result(p.oid) as result_type,
          pg_get_function_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname IN ('public', 'auth')
        AND (p.proname LIKE '%profile%' OR p.proname LIKE '%user%');
      `
    });
    
    if (functionsError) {
      console.log('❌ Functions query failed:', functionsError.message);
    } else {
      console.log('✅ Functions related to profiles/users:', functionsData);
    }
    
    // Check for RLS policies on profiles table
    console.log('\n3. Checking RLS status on profiles table...');
    const { data: rlsStatusData, error: rlsStatusError } = await supabaseAdmin.rpc('sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          rowsecurity
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles';
      `
    });
    
    if (rlsStatusError) {
      console.log('❌ RLS status query failed:', rlsStatusError.message);
    } else {
      console.log('✅ RLS status for profiles:', rlsStatusData);
    }
    
    // Try to check policies
    console.log('\n4. Checking policies on profiles table...');
    const { data: policiesData, error: policiesError } = await supabaseAdmin.rpc('sql', {
      query: `
        SELECT 
          pol.polname AS policy_name,
          pol.polcmd AS policy_command,
          pol.polroles AS policy_roles,
          pol.polqual AS policy_expression
        FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
        WHERE nsp.nspname = 'public' 
        AND cls.relname = 'profiles';
      `
    });
    
    if (policiesError) {
      console.log('❌ Policies query failed:', policiesError.message);
    } else {
      console.log('✅ Policies on profiles table:', policiesData);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTriggers();