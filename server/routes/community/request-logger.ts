import type { Request, Response, NextFunction } from 'express';

// Debug middleware to log all community requests
export function debugCommunityRequests(req: Request, res: Response, _next: NextFunction) {
  console.log(`[COMMUNITY DEBUG] ${req.method} ${req.originalUrl}`);
  console.log('[COMMUNITY DEBUG] Headers:', {
    authorization: req.headers.authorization ? 'Bearer token present' : 'No auth header',
    contentType: req.headers['content-type']
  });
  console.log('[COMMUNITY DEBUG] User:', req.user);
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[COMMUNITY DEBUG] Response status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.log('[COMMUNITY DEBUG] Error response:', data);
    }
    return originalSend.call(this, data);
  };
  
  next();
}