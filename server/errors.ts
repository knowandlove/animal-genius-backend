/**
 * Re-export error classes from the new comprehensive error system
 * This maintains backward compatibility while using the new error infrastructure
 */

export {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  AppError,
  BusinessError,
  ConflictError,
  InternalError,
  RateLimitError,
  ErrorCode,
  ErrorStatus,
  normalizeError,
  type ErrorResponse
} from './utils/errors';
