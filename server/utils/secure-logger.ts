/**
 * Secure logging utility that sanitizes sensitive data
 */

interface SensitivePatterns {
  [key: string]: RegExp | string[];
}

const SENSITIVE_PATTERNS: SensitivePatterns = {
  // Authentication
  password: /password/i,
  token: /token|jwt|bearer/i,
  secret: /secret|key/i,
  authorization: /authorization/i,
  
  // Database
  database_url: /database_url|postgresql:\/\/[^@]+@/i,
  
  // API Keys
  api_key: /api_key|apikey/i,
  supabase_key: /supabase.*key/i,
  
  // Personal Data
  email: /email/i,
  phone: /phone|mobile/i,
  ssn: /ssn|social.*security/i,
  
  // Financial
  card: /card.*number|credit.*card/i,
  cvv: /cvv|cvc/i,
  account: /account.*number/i
};

const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'key', 'authorization',
  'cookie', 'session', 'jwt', 'bearer', 'api_key', 'apiKey',
  'database_url', 'DATABASE_URL', 'supabase_key', 'SUPABASE_KEY',
  'email', 'phone', 'ssn', 'cardNumber', 'cvv', 'accountNumber'
];

/**
 * Recursively sanitize an object by masking sensitive fields
 */
export function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 10) return '[Too Deep]'; // Prevent infinite recursion
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Check if string contains sensitive patterns
    for (const [key, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
      if (pattern instanceof RegExp && pattern.test(obj)) {
        return '[REDACTED]';
      }
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if key name suggests sensitive data
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
    
    return sanitized;
  }
  
  return obj;
}

/**
 * Safe console.log that sanitizes sensitive data
 */
export function secureLog(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === 'production') {
    // In production, be even more strict about logging
    return;
  }
  
  const sanitizedArgs = args.map(arg => {
    if (typeof arg === 'object') {
      return sanitizeObject(arg);
    }
    return arg;
  });
  
  console.log(message, ...sanitizedArgs);
}

/**
 * Safe console.error that sanitizes sensitive data
 */
export function secureError(message: string, ...args: any[]) {
  const sanitizedArgs = args.map(arg => {
    if (typeof arg === 'object') {
      return sanitizeObject(arg);
    }
    return arg;
  });
  
  console.error(message, ...sanitizedArgs);
}

export interface SecureLogger {
  log: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
}

/**
 * Create a secure logger instance with context
 */
export function createSecureLogger(context: string): SecureLogger {
  return {
    log: (message: string, ...args: any[]) => secureLog(`[${context}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => secureError(`[${context}] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => {
      if (process.env.NODE_ENV === 'development') {
        secureLog(`[${context}:DEBUG] ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: any[]) => {
      const sanitizedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          return sanitizeObject(arg);
        }
        return arg;
      });
      console.warn(`[${context}:WARN] ${message}`, ...sanitizedArgs);
    }
  };
}

/**
 * Sanitize error objects before logging
 */
export function sanitizeError(error: any): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      // Remove any custom properties that might contain sensitive data
      ...sanitizeObject({ ...error })
    };
  }
  return sanitizeObject(error);
}