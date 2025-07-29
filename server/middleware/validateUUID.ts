import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { uuidSchema } from '../../shared/validation';

/**
 * Middleware to validate UUID parameters in routes
 * @param paramName - The name of the parameter to validate (default: 'id')
 * @returns Express middleware function
 */
export function validateUUID(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const value = req.params[paramName];
      
      if (!value) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Missing required parameter: ${paramName}`,
            code: 'MISSING_PARAMETER'
          }
        });
      }

      // Validate the UUID
      uuidSchema.parse(value);
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Invalid ${paramName}: must be a valid UUID`,
            code: 'INVALID_UUID',
            details: error.errors
          }
        });
      }
      
      // Unexpected error
      console.error('UUID validation error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  };
}

/**
 * Middleware to validate multiple UUID parameters at once
 * @param paramNames - Array of parameter names to validate
 * @returns Express middleware function
 */
export function validateUUIDs(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const paramName of paramNames) {
        const value = req.params[paramName];
        
        if (!value) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Missing required parameter: ${paramName}`,
              code: 'MISSING_PARAMETER'
            }
          });
        }

        // Validate the UUID
        uuidSchema.parse(value);
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid UUID parameter',
            code: 'INVALID_UUID',
            details: error.errors
          }
        });
      }
      
      // Unexpected error
      console.error('UUID validation error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  };
}

/**
 * Middleware to validate UUID in request body
 * @param fieldName - The name of the field to validate
 * @returns Express middleware function
 */
export function validateBodyUUID(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const value = req.body[fieldName];
      
      if (!value) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Missing required field: ${fieldName}`,
            code: 'MISSING_FIELD'
          }
        });
      }

      // Validate the UUID
      uuidSchema.parse(value);
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Invalid ${fieldName}: must be a valid UUID`,
            code: 'INVALID_UUID',
            details: error.errors
          }
        });
      }
      
      // Unexpected error
      console.error('UUID validation error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  };
}