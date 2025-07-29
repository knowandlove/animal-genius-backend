/**
 * Async route wrapper utility
 * 
 * Wraps async route handlers to automatically catch errors
 * and pass them to the error handling middleware
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to catch errors
 */
export function asyncWrapper(
  fn: (req: Request, res: Response, _next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, _next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Type-safe async handler for routes that return data
 */
export function asyncHandler<T = any>(
  fn: (req: Request, res: Response) => Promise<T>
) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const result = await fn(req, res);
      
      // If the handler already sent a response, don't send another
      if (!res.headersSent && result !== undefined) {
        res.json(result);
      }
    } catch (error) {
      next(error);
    }
  };
}