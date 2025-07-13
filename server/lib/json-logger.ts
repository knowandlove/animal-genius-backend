import { Request, Response } from 'express';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: any;
}

// Sensitive data patterns for sanitization
const SENSITIVE_PATTERNS: Record<string, RegExp> = {
  password: /password/i,
  token: /token|jwt|bearer/i,
  secret: /secret|key/i,
  authorization: /authorization/i,
  database_url: /database_url|postgresql:\/\/[^@]+@/i,
  api_key: /api_key|apikey/i,
  supabase_key: /supabase.*key/i,
  email: /email/i,
  phone: /phone|mobile/i,
  ssn: /ssn|social.*security/i,
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

class JSONLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Recursively sanitize an object by masking sensitive fields
   */
  private sanitizeObject(obj: any, depth = 0): any {
    if (depth > 10) return '[Too Deep]'; // Prevent infinite recursion
    
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      // Check if string contains sensitive patterns
      for (const [key, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
        if (pattern.test(obj)) {
          return '[REDACTED]';
        }
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
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
        sanitized[key] = this.sanitizeObject(value, depth + 1);
      }
      
      return sanitized;
    }
    
    return obj;
  }

  private formatLog(level: LogLevel, message: string, context: LogContext = {}): string {
    // Sanitize the context before stringifying
    const sanitizedContext = this.sanitizeObject(context);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitizedContext
    };
    return JSON.stringify(logEntry);
  }

  private getRequestContext(req?: Request, res?: Response): LogContext {
    const context: LogContext = {};
    
    if (req) {
      context.method = req.method;
      context.path = req.path;
      context.ip = req.ip;
    }
    
    if (res?.locals?.requestId) {
      context.requestId = res.locals.requestId;
    }
    
    if (res?.locals?.userId) {
      context.userId = res.locals.userId;
    }
    
    return context;
  }

  debug(message: string, context: LogContext = {}, req?: Request, res?: Response): void {
    if (this.isDevelopment) {
      const fullContext = { ...this.getRequestContext(req, res), ...context };
      console.log(this.formatLog('debug', message, fullContext));
    }
  }

  info(message: string, context: LogContext = {}, req?: Request, res?: Response): void {
    const fullContext = { ...this.getRequestContext(req, res), ...context };
    console.log(this.formatLog('info', message, fullContext));
  }

  warn(message: string, context: LogContext = {}, req?: Request, res?: Response): void {
    const fullContext = { ...this.getRequestContext(req, res), ...context };
    console.warn(this.formatLog('warn', message, fullContext));
  }

  error(message: string, error?: Error | unknown, context: LogContext = {}, req?: Request, res?: Response): void {
    const fullContext = { ...this.getRequestContext(req, res), ...context };
    
    if (error) {
      if (error instanceof Error) {
        fullContext.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      } else {
        fullContext.error = String(error);
      }
    }
    
    console.error(this.formatLog('error', message, fullContext));
  }

  // HTTP request logging
  http(req: Request, res: Response, duration: number): void {
    const level: LogLevel = res.statusCode >= 500 ? 'error' : 
                           res.statusCode >= 400 ? 'warn' : 
                           'info';
    
    const context: LogContext = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId: res.locals.requestId,
      userId: res.locals.userId,
      ip: req.ip
    };
    
    const message = `HTTP ${req.method} ${req.path} ${res.statusCode}`;
    
    if (level === 'error') {
      console.error(this.formatLog(level, message, context));
    } else if (level === 'warn') {
      console.warn(this.formatLog(level, message, context));
    } else {
      console.log(this.formatLog(level, message, context));
    }
  }
}

// Export singleton instance
export const jsonLogger = new JSONLogger();