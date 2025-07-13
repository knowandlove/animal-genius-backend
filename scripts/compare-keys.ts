import dotenv from 'dotenv';

dotenv.config();

// Get the keys from your .env
const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const envAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('From your .env file:');
console.log('Service key first 50 chars:', envServiceKey?.substring(0, 50));
console.log('Anon key first 50 chars:', envAnonKey?.substring(0, 50));

// Decode to check roles
if (envServiceKey) {
  try {
    const parts = envServiceKey.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('\nService key payload:', {
      role: payload.role,
      iss: payload.iss,
      ref: payload.ref
    });
  } catch (e) {
    console.log('Could not decode service key');
  }
}

console.log('\n⚠️  IMPORTANT: Compare the "Service key first 50 chars" above with what you see in:');
console.log('Supabase Dashboard > Settings > API > service_role (secret)');
console.log('They should match EXACTLY!');