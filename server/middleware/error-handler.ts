/**
 * Global Error Handling Middleware
 * 
 * Provides centralized error handling for all routes,
 * ensuring consistent error responses and proper logging.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  AppError, 
  normalizeError, 
  shouldLogError, 
  formatErrorForLogging,
  ErrorCode,
  ErrorStatus
} from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';
import { errorTracker } from '../monitoring/error-tracker';

const logger = createSecureLogger('ErrorHandler');

/**
 * Request ID middleware - adds unique ID to each request
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
}

/**
 * Async route handler wrapper
 * Catches async errors and passes them to error middleware
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => any) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handler middleware
 * This should be the last middleware registered
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Normalize the error
  const appError = normalizeError(err);
  
  // Generate request ID if not present
  const requestId = req.id || uuidv4();
  
  // Log error if necessary
  if (shouldLogError(appError)) {
    logger.error('Request failed', formatErrorForLogging(appError, req));
  }
  
  // Track error in monitoring system
  errorTracker.trackError({
    code: appError.code,
    message: appError.message,
    statusCode: appError.statusCode,
    endpoint: req.path,
    userId: req.user?.userId,
    requestId,
    stack: process.env.NODE_ENV === 'development' ? appError.stack : undefined
  });
  
  // Send error response
  const response = appError.toResponse(requestId);
  res.status(appError.statusCode).json(response);
}

/**
 * 404 Not Found handler
 * This should come after all other routes
 */
export function notFoundHandler(req: Request, res: Response) {
  const requestId = req.id || uuidv4();
  
  res.status(ErrorStatus.NOT_FOUND).json({
    error: {
      code: ErrorCode.RES_001,
      message: 'The requested endpoint does not exist',
      requestId
    }
  });
}

/**
 * Validation error handler
 * Extracts and formats Zod validation errors
 */
export function handleValidationError(error: any): AppError | null {
  if (error.name === 'ZodError') {
    const details = error.errors.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
    
    return new AppError(
      ErrorCode.VAL_001,
      'Validation failed',
      ErrorStatus.BAD_REQUEST,
      true,
      details
    );
  }
  
  return null;
}

/**
 * Database error handler
 * Maps database-specific errors to app errors
 */
export function handleDatabaseError(error: any): AppError | null {
  // PostgreSQL error codes
  const pgErrorMap: Record<string, { code: ErrorCode; message: string; status: number }> = {
    '23505': { // unique_violation
      code: ErrorCode.BIZ_006,
      message: 'This resource already exists',
      status: ErrorStatus.CONFLICT
    },
    '23503': { // foreign_key_violation
      code: ErrorCode.VAL_003,
      message: 'Invalid reference provided',
      status: ErrorStatus.BAD_REQUEST
    },
    '23502': { // not_null_violation
      code: ErrorCode.VAL_002,
      message: 'Required field is missing',
      status: ErrorStatus.BAD_REQUEST
    },
    '23514': { // check_violation
      code: ErrorCode.VAL_003,
      message: 'Value violates constraint',
      status: ErrorStatus.BAD_REQUEST
    }
  };
  
  if (error.code && pgErrorMap[error.code]) {
    const mapped = pgErrorMap[error.code];
    return new AppError(
      mapped.code,
      mapped.message,
      mapped.status,
      true
    );
  }
  
  return null;
}

/**
 * Express-specific error handler
 * Handles errors from body-parser, multer, etc.
 */
export function handleExpressError(error: any): AppError | null {
  // Body parser errors
  if (error.type === 'entity.too.large') {
    return new AppError(
      ErrorCode.VAL_003,
      'Request body too large',
      ErrorStatus.BAD_REQUEST,
      true
    );
  }
  
  if (error.type === 'entity.parse.failed') {
    return new AppError(
      ErrorCode.VAL_001,
      'Invalid JSON in request body',
      ErrorStatus.BAD_REQUEST,
      true
    );
  }
  
  // Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(
      ErrorCode.VAL_003,
      'File size exceeds limit',
      ErrorStatus.BAD_REQUEST,
      true
    );
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(
      ErrorCode.VAL_001,
      'Unexpected file field',
      ErrorStatus.BAD_REQUEST,
      true
    );
  }
  
  return null;
}

/**
 * Create error from service response
 * Converts service-style errors to AppError
 */
export function createErrorFromService(
  success: boolean,
  error?: string,
  statusCode = ErrorStatus.BAD_REQUEST
): AppError | null {
  if (!success && error) {
    // Map common service errors
    const errorMap: Record<string, { code: ErrorCode; status: number }> = {
      'Insufficient balance': { code: ErrorCode.BIZ_001, status: ErrorStatus.UNPROCESSABLE_ENTITY },
      'Insufficient funds': { code: ErrorCode.BIZ_001, status: ErrorStatus.UNPROCESSABLE_ENTITY },
      'Item already owned': { code: ErrorCode.BIZ_002, status: ErrorStatus.CONFLICT },
      'Store is closed': { code: ErrorCode.BIZ_003, status: ErrorStatus.UNPROCESSABLE_ENTITY },
      'Quiz already submitted': { code: ErrorCode.BIZ_004, status: ErrorStatus.CONFLICT },
      'Class is full': { code: ErrorCode.BIZ_005, status: ErrorStatus.UNPROCESSABLE_ENTITY },
      'Student already has a pet': { code: ErrorCode.BIZ_002, status: ErrorStatus.CONFLICT },
    };
    
    const mapped = Object.entries(errorMap).find(([key]) => 
      error.toLowerCase().includes(key.toLowerCase())
    );
    
    if (mapped) {
      const [, { code, status }] = mapped;
      return new AppError(code, error, status, true);
    }
    
    // Default business error
    return new AppError(ErrorCode.BIZ_001, error, statusCode, true);
  }
  
  return null;
}

// Extend Express Request type to include id
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}