/**
 * Standardized Error Handling System
 * 
 * This module provides a comprehensive error handling infrastructure
 * for the Animal Genius backend, ensuring consistent error responses
 * and preventing sensitive information leakage.
 */

import { ZodError } from 'zod';

/**
 * Standard error codes for categorizing errors
 * Format: CATEGORY_NUMBER (e.g., AUTH_001)
 */
export enum ErrorCode {
  // Authentication errors (AUTH_xxx)
  AUTH_001 = 'AUTH_001', // Invalid credentials
  AUTH_002 = 'AUTH_002', // Token expired
  AUTH_003 = 'AUTH_003', // Token invalid
  AUTH_004 = 'AUTH_004', // No token provided
  AUTH_005 = 'AUTH_005', // Account locked
  AUTH_006 = 'AUTH_006', // Passport code invalid
  
  // Authorization errors (AUTHZ_xxx)
  AUTHZ_001 = 'AUTHZ_001', // Insufficient permissions
  AUTHZ_002 = 'AUTHZ_002', // Resource access denied
  AUTHZ_003 = 'AUTHZ_003', // Role mismatch
  
  // Validation errors (VAL_xxx)
  VAL_001 = 'VAL_001', // Invalid input format
  VAL_002 = 'VAL_002', // Missing required field
  VAL_003 = 'VAL_003', // Field constraint violation
  
  // Business logic errors (BIZ_xxx)
  BIZ_001 = 'BIZ_001', // Insufficient funds
  BIZ_002 = 'BIZ_002', // Item already owned
  BIZ_003 = 'BIZ_003', // Store closed
  BIZ_004 = 'BIZ_004', // Quiz already submitted
  BIZ_005 = 'BIZ_005', // Class full
  BIZ_006 = 'BIZ_006', // Duplicate entry
  
  // Resource errors (RES_xxx)
  RES_001 = 'RES_001', // Resource not found
  RES_002 = 'RES_002', // Resource already exists
  RES_003 = 'RES_003', // Resource locked
  
  // Rate limiting errors (RATE_xxx)
  RATE_001 = 'RATE_001', // Too many requests
  RATE_002 = 'RATE_002', // Account temporarily locked
  
  // System errors (SYS_xxx)
  SYS_001 = 'SYS_001', // Internal server error
  SYS_002 = 'SYS_002', // Database error
  SYS_003 = 'SYS_003', // External service error
  SYS_004 = 'SYS_004', // Configuration error
}

/**
 * HTTP status codes mapped to error types
 */
export const ErrorStatus = {
  // 4xx Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // 5xx Server errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    requestId?: string;
  };
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    isOperational = true,
    details?: any
  ) {
    super(message);
    
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }

  /**
   * Convert error to response format
   * Sanitizes error for client consumption
   */
  toResponse(requestId?: string): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.statusCode < 500 && this.details ? { details: this.details } : {}),
        ...(requestId ? { requestId } : {})
      }
    };
  }
}

/**
 * Authentication error - 401
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', code = ErrorCode.AUTH_001, details?: any) {
    super(code, message, ErrorStatus.UNAUTHORIZED, true, details);
  }
}

/**
 * Authorization error - 403
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Access denied', code = ErrorCode.AUTHZ_001, details?: any) {
    super(code, message, ErrorStatus.FORBIDDEN, true, details);
  }
}

/**
 * Validation error - 400
 */
export class ValidationError extends AppError {
  constructor(message = 'Invalid input', code = ErrorCode.VAL_001, details?: any) {
    super(code, message, ErrorStatus.BAD_REQUEST, true, details);
  }
}

/**
 * Not found error - 404
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource', code = ErrorCode.RES_001) {
    super(code, `${resource} not found`, ErrorStatus.NOT_FOUND, true);
  }
}

/**
 * Conflict error - 409
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = ErrorCode.RES_002, details?: any) {
    super(code, message, ErrorStatus.CONFLICT, true, details);
  }
}

/**
 * Business logic error - 422
 */
export class BusinessError extends AppError {
  constructor(message: string, code = ErrorCode.BIZ_001, details?: any) {
    super(code, message, ErrorStatus.UNPROCESSABLE_ENTITY, true, details);
  }
}

/**
 * Rate limit error - 429
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', code = ErrorCode.RATE_001, details?: any) {
    super(code, message, ErrorStatus.TOO_MANY_REQUESTS, true, details);
  }
}

/**
 * Internal server error - 500
 */
export class InternalError extends AppError {
  constructor(message = 'An internal error occurred', code = ErrorCode.SYS_001) {
    super(code, message, ErrorStatus.INTERNAL_SERVER_ERROR, false);
  }
}

/**
 * Transform various error types into AppError instances
 */
export function normalizeError(error: unknown): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Zod validation error
  if (error instanceof ZodError) {
    const details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
    return new ValidationError('Validation failed', ErrorCode.VAL_001, details);
  }

  // Database errors (Postgres)
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as any;
    
    // Unique constraint violation
    if (dbError.code === '23505') {
      return new ConflictError('Resource already exists', ErrorCode.BIZ_006);
    }
    
    // Foreign key violation
    if (dbError.code === '23503') {
      return new ValidationError('Invalid reference', ErrorCode.VAL_003);
    }
    
    // Not null violation
    if (dbError.code === '23502') {
      return new ValidationError('Missing required field', ErrorCode.VAL_002);
    }
  }

  // Generic Error object
  if (error instanceof Error) {
    // Don't expose internal error messages
    return new InternalError();
  }

  // Unknown error type
  return new InternalError();
}

/**
 * Error message sanitizer
 * Removes sensitive information from error messages
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove file paths
  message = message.replace(/\/[\w\/\-\.]+\.(ts|js|json)/g, '[file]');
  
  // Remove potential passwords or tokens
  message = message.replace(/password['\"]?\s*[:=]\s*['\"]?[\w\-\.]+/gi, 'password=[redacted]');
  message = message.replace(/token['\"]?\s*[:=]\s*['\"]?[\w\-\.]+/gi, 'token=[redacted]');
  
  // Remove database details
  message = message.replace(/postgres:\/\/[^@]+@[^/]+/g, 'postgres://[redacted]');
  
  // Remove IP addresses
  message = message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip-address]');
  
  return message;
}

/**
 * Check if error should be logged
 */
export function shouldLogError(error: AppError): boolean {
  // Always log non-operational errors
  if (!error.isOperational) return true;
  
  // Log certain error codes
  const alwaysLog = [
    ErrorCode.AUTH_005, // Account locked
    ErrorCode.SYS_001, // Internal error
    ErrorCode.SYS_002, // Database error
    ErrorCode.SYS_003, // External service error
  ];
  
  return alwaysLog.includes(error.code);
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: AppError, req?: any): object {
  return {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...(req ? {
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: req.user?.id || req.studentId,
      }
    } : {})
  };
}