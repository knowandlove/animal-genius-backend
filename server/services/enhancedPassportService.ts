import { customAlphabet } from 'nanoid';

// Animal-based passport code generation with increased entropy
const ANIMAL_PREFIXES = {
  'meerkat': 'MEE',
  'panda': 'PAN',
  'owl': 'OWL',
  'beaver': 'BEA',
  'elephant': 'ELE',
  'otter': 'OTT',
  'parrot': 'PAR',
  'border-collie': 'BOR',
  'fox': 'FOX',
  'bear': 'BER',
  'wolf': 'WOL',
  'deer': 'DEE',
  'penguin': 'PEN',
  'horse': 'HOR',
  'dove': 'DOV',
  'lion': 'LIO'
};

// Use a larger character set for the suffix
// This gives us 36^6 = 2.1 billion combinations per animal type
const generateSuffix = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export function generateEnhancedPassportCode(animalType: string): string {
  const prefix = ANIMAL_PREFIXES[animalType as keyof typeof ANIMAL_PREFIXES] || 'UNK';
  const suffix = generateSuffix();
  return `${prefix}-${suffix}`;
}

// Simple in-memory rate limiting
class RateLimiter {
  private attempts = new Map<string, { count: number; firstAttempt: number }>();
  private readonly windowMs = 60000; // 1 minute
  private readonly maxAttempts = 5;
  private readonly blockDurationMs = 600000; // 10 minutes

  check(ip: string, passportCode: string): { allowed: boolean; message?: string } {
    const key = `${ip}:${passportCode}`;
    const now = Date.now();
    
    const record = this.attempts.get(key);
    
    if (!record) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return { allowed: true };
    }
    
    // Clean up old attempts
    if (now - record.firstAttempt > this.windowMs + this.blockDurationMs) {
      this.attempts.delete(key);
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return { allowed: true };
    }
    
    // Check if blocked
    if (record.count >= this.maxAttempts) {
      const blockedUntil = record.firstAttempt + this.windowMs + this.blockDurationMs;
      if (now < blockedUntil) {
        const minutesLeft = Math.ceil((blockedUntil - now) / 60000);
        return { 
          allowed: false, 
          message: `Too many attempts. Please try again in ${minutesLeft} minutes.` 
        };
      } else {
        // Block expired, reset
        this.attempts.delete(key);
        this.attempts.set(key, { count: 1, firstAttempt: now });
        return { allowed: true };
      }
    }
    
    // Within window, increment attempts
    record.count++;
    return { allowed: true };
  }
  
  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now - record.firstAttempt > this.windowMs + this.blockDurationMs) {
        this.attempts.delete(key);
      }
    }
  }
}

export const passportRateLimiter = new RateLimiter();

// Run cleanup every 5 minutes
setInterval(() => passportRateLimiter.cleanup(), 300000);
