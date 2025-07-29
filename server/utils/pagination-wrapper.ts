/**
 * Wrapper to add pagination to existing endpoints without breaking backward compatibility
 */

import { Request, Response, NextFunction } from 'express';
import { getPaginationParams, createPaginatedResponse, setPaginationHeaders } from './pagination';

// Re-export pagination utilities for convenience
export { getPaginationParams, setPaginationHeaders } from './pagination';

/**
 * Middleware to add pagination support to endpoints that return arrays
 * This allows gradual migration without breaking existing clients
 */
export function paginationWrapper(
  handler: (req: Request, res: Response, _next: NextFunction) => Promise<void>
) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    // If no pagination params, use original handler
    if (!req.query.page && !req.query.limit) {
      return handler(req, res, next);
    }

    // Override res.json to intercept array responses
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      // Only paginate array responses
      if (Array.isArray(data)) {
        const { page, limit, offset } = getPaginationParams(req);
        const total = data.length;
        
        // Slice the array for pagination
        const paginatedData = data.slice(offset, offset + limit);
        
        // Create paginated response
        const response = createPaginatedResponse(paginatedData, page, limit, total);
        
        // Set headers
        setPaginationHeaders(res, page, limit, total);
        
        return originalJson(response);
      }
      
      // For non-array responses, use original
      return originalJson(data);
    };
    
    return handler(req, res, next);
  };
}

/**
 * Add pagination info to an existing response object
 * Useful for responses that have a specific structure
 */
export function addPaginationToResponse(
  response: any,
  arrayField: string,
  page: number,
  limit: number
): any {
  if (!response[arrayField] || !Array.isArray(response[arrayField])) {
    return response;
  }
  
  const data = response[arrayField];
  const total = data.length;
  const offset = (page - 1) * limit;
  
  return {
    ...response,
    [arrayField]: data.slice(offset, offset + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
}