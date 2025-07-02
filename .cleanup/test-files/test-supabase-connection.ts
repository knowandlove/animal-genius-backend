import { config } from 'dotenv';
import { supabaseAnon } from '../server/supabase-clients';

config();

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test 1: Try to get the current session (should be null)
    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.getSession();
    console.log('Session test:', { hasSession: !!sessionData?.session, error: sessionError });
    
    // Test 2: Try to sign in with test credentials
    const email = process.argv[2] || 'test@example.com';
    const password = process.argv[3] || 'password123';
    
    console.log(`\nTrying to sign in with: ${email}`);
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) {
      console.error('Sign in error:', authError);
      console.error('Error details:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
        name: authError.name
      });
    } else {
      console.log('Sign in successful!');
      console.log('User ID:', authData.user?.id);
      console.log('Token preview:', authData.session?.access_token?.substring(0, 30) + '...');
    }
    
    // Test 3: Check Supabase project status
    console.log('\nSupabase configuration:');
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('Anon key length:', process.env.SUPABASE_ANON_KEY?.length);
    console.log('Service key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSupabaseConnection();
