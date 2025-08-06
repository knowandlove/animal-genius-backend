import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { featureFlags } from '../../shared/schema-gardens.js';
import { eq } from 'drizzle-orm';
import { getCache } from '../lib/cache-factory.js';

/**
 * Middleware to check if a feature flag is enabled
 */
export function checkFeatureFlag(flagName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check cache first
      const cache = getCache();
      const cacheKey = `feature-flag:${flagName}`;
      const cached = await cache.get<boolean>(cacheKey);
      
      if (cached !== null) {
        if (!cached) {
          return res.status(503).json({
            success: false,
            error: 'This feature is currently disabled',
            code: 'FEATURE_DISABLED'
          });
        }
        return next();
      }

      // Check database
      const [flag] = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.id, flagName))
        .limit(1);

      const isEnabled = flag?.isEnabled ?? false;
      
      // Cache for 5 minutes
      await cache.set(cacheKey, isEnabled, 300);

      if (!isEnabled) {
        return res.status(503).json({
          success: false,
          error: 'This feature is currently disabled',
          code: 'FEATURE_DISABLED'
        });
      }

      next();
    } catch (error) {
      console.error('Feature flag check error:', error);
      // Default to disabled on error
      return res.status(503).json({
        success: false,
        error: 'Feature availability could not be determined',
        code: 'FEATURE_CHECK_ERROR'
      });
    }
  };
}

/**
 * Enable or disable a feature flag (admin only)
 */
export async function setFeatureFlag(flagName: string, enabled: boolean): Promise<void> {
  await db
    .update(featureFlags)
    .set({ 
      isEnabled: enabled,
      updatedAt: new Date()
    })
    .where(eq(featureFlags.id, flagName));

  // Clear cache
  const cache = getCache();
  await cache.del(`feature-flag:${flagName}`);
}