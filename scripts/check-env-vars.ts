import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config();

// Check for hidden characters in environment variables
function checkEnvVar(name: string) {
  const value = process.env[name];
  if (!value) {
    console.log(`❌ ${name} is not set`);
    return;
  }
  
  console.log(`\n${name}:`);
  console.log(`- Length: ${value.length}`);
  console.log(`- Starts with: "${value.substring(0, 10)}"`);
  console.log(`- Ends with: "${value.substring(value.length - 10)}"`);
  console.log(`- Has spaces: ${value.includes(' ')}`);
  console.log(`- Has newlines: ${value.includes('\n')}`);
  console.log(`- Has tabs: ${value.includes('\t')}`);
  
  // Check for common URL issues
  if (name.includes('URL')) {
    console.log(`- Has trailing slash: ${value.endsWith('/')}`);
    console.log(`- Protocol: ${value.startsWith('https://') ? 'HTTPS' : value.startsWith('http://') ? 'HTTP' : 'UNKNOWN'}`);
  }
  
  // Check JWT structure for keys
  if (name.includes('KEY')) {
    const parts = value.split('.');
    console.log(`- JWT parts: ${parts.length} (should be 3)`);
    if (parts.length === 3) {
      try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        console.log(`- Header alg: ${header.alg}`);
        console.log(`- Header typ: ${header.typ}`);
      } catch (e) {
        console.log(`- Failed to decode header`);
      }
    }
  }
}

console.log('Checking Supabase environment variables...\n');

checkEnvVar('SUPABASE_URL');
checkEnvVar('SUPABASE_ANON_KEY');
checkEnvVar('SUPABASE_SERVICE_ROLE_KEY');

// Also check the .env file directly
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

console.log('\n\nChecking .env file directly:');
lines.forEach((line, index) => {
  if (line.includes('SUPABASE_')) {
    const trimmed = line.trim();
    console.log(`Line ${index + 1}: ${trimmed.substring(0, 50)}... (length: ${trimmed.length})`);
  }
});
