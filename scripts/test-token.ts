import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testToken() {
  const token = process.argv[2];
  
  if (!token) {
    console.error('Usage: npm run test-token <token>');
    process.exit(1);
  }
  
  console.log('Testing token:', token.substring(0, 20) + '...');
  
  try {
    // Test if token is valid
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Token validation error:', error);
      return;
    }
    
    if (user) {
      console.log('Token is valid!');
      console.log('User ID:', user.id);
      console.log('Email:', user.email);
      console.log('Created at:', user.created_at);
    } else {
      console.log('No user found for this token');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

testToken();
