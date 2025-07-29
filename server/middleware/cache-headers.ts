import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set appropriate cache headers for different types of content
 */
export function setCacheHeaders(req: Request, res: Response, next: NextFunction) {
  // Skip cache headers for API endpoints
  if (req.path.startsWith('/api/')) {
    // API responses should not be cached by default
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return next();
  }

  // For static assets served by Express (fallback for local development)
  if (req.path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    // Images can be cached for a long time
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.path.match(/\.(js|css)$/i)) {
    // JS and CSS files - cache but revalidate
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
  } else if (req.path.match(/\.(woff|woff2|ttf|eot)$/i)) {
    // Fonts can be cached for a long time
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  next();
}

/**
 * Set cache headers specifically for asset responses
 */
export function setAssetCacheHeaders(res: Response, mimeType?: string) {
  // Determine cache duration based on content type
  if (mimeType && mimeType.startsWith('image/')) {
    // Images are immutable - cache forever
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
  } else {
    // Other content - cache for 1 day
    res.set({
      'Cache-Control': 'public, max-age=86400, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    });
  }
}
