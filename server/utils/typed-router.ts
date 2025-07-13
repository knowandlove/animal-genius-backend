import { RequestHandler } from 'express';
import type { AuthenticatedRequest, StudentAuthenticatedRequest } from '../types/api';

/**
 * Helper function to properly type route handlers with custom request types
 */
export function typedHandler<T = AuthenticatedRequest>(
  ...handlers: RequestHandler[]
): RequestHandler[] {
  return handlers as any;
}

/**
 * Typed handler for authenticated routes
 */
export const authHandler = (...handlers: RequestHandler[]) => 
  typedHandler<AuthenticatedRequest>(...handlers);

/**
 * Typed handler for student authenticated routes
 */
export const studentHandler = (...handlers: RequestHandler[]) => 
  typedHandler<StudentAuthenticatedRequest>(...handlers);

