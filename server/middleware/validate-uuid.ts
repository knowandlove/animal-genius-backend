import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Middleware to validate UUID parameters
 * Usage: app.get('/api/items/:id', validateUUID('id'), handler)
 */
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    const result = z.string().uuid().safeParse(value);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: `Invalid ${paramName}: must be a valid UUID`,
        message: `The provided ${paramName} is not a valid identifier`
      });
    }
    
    next();
  };
};

/**
 * Middleware to validate multiple UUID parameters at once
 * Usage: app.get('/api/classes/:classId/students/:studentId', validateUUIDs(['classId', 'studentId']), handler)
 */
export const validateUUIDs = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      const result = z.string().uuid().safeParse(value);
      
      if (!result.success) {
        errors.push(`${paramName} must be a valid UUID`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid parameters',
        message: errors.join(', ')
      });
    }
    
    next();
  };
};
