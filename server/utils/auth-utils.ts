import crypto from 'crypto';

/**
 * Generate a secure, deterministic password for a student based on their passport code
 * This allows students to be migrated to Supabase auth without knowing their password
 */
export function generateSecurePassword(passportCode: string, salt: string): string {
  // Use PBKDF2 for proper password derivation with high iteration count
  // This is more resistant to brute-force attacks than a simple hash
  const iterations = 100000;
  const keyLength = 32; // 256 bits
  const digest = 'sha512';
  
  const derivedKey = crypto.pbkdf2Sync(
    passportCode,
    salt,
    iterations,
    keyLength,
    digest
  );
  
  // Convert to base64 for a strong password
  // Add special character to meet complexity requirements
  const base64Password = derivedKey.toString('base64');
  
  // Ensure the password meets common requirements:
  // - Has uppercase and lowercase (base64 provides this)
  // - Has numbers (base64 provides this)
  // - Has special characters (we add one)
  // - Sufficient length (base64 of 32 bytes = 44 chars)
  return base64Password + '!';
}

