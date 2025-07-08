/**
 * Cache Factory - Provides unified cache interface
 * Switches between NodeCache and Redis based on configuration
 */

import { redisCache } from './redis-cache';
import * as nodeCache from './cache';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('CacheFactory');

export interface CacheInterface {
  get<T>(key: string): Promise<T | undefined> | T | undefined;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean> | boolean;
  del(keys: string | string[]): Promise<number> | number;
  flush(): Promise<void> | void;
  getStats(): Promise<any> | any;
}

/**
 * Async cache wrapper that ensures all operations return promises
 */
class AsyncCacheWrapper implements CacheInterface {
  constructor(private cache: typeof nodeCache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    return this.cache.set(key, value, ttl);
  }

  async del(keys: string | string[]): Promise<number> {
    return this.cache.del(keys);
  }

  async flush(): Promise<void> {
    return this.cache.flush();
  }

  async getStats(): Promise<any> {
    return this.cache.getStats();
  }
}

/**
 * Cache factory configuration
 */
export interface CacheConfig {
  type: 'node' | 'redis';
  redisUrl?: string;
}

/**
 * Create a cache instance based on configuration
 */
export function createCache(config?: CacheConfig): CacheInterface {
  // Default to NodeCache if not configured
  if (!config || config.type === 'node') {
    logger.log('Using NodeCache (in-memory) cache implementation');
    return new AsyncCacheWrapper(nodeCache);
  }

  if (config.type === 'redis') {
    logger.log('Using Redis cache implementation');
    return redisCache;
  }

  // Fallback to NodeCache
  logger.warn('Unknown cache type, falling back to NodeCache');
  return new AsyncCacheWrapper(nodeCache);
}

/**
 * Global cache instance
 * Can be configured via environment variables
 */
let globalCache: CacheInterface | null = null;

export function getCache(): CacheInterface {
  if (!globalCache) {
    // Check environment for cache configuration
    const cacheType = process.env.CACHE_TYPE || 'node';
    
    if (cacheType === 'redis' && process.env.REDIS_URL) {
      globalCache = createCache({ type: 'redis', redisUrl: process.env.REDIS_URL });
    } else {
      globalCache = createCache({ type: 'node' });
    }
  }

  return globalCache;
}

/**
 * Migration helper - temporarily use both caches during migration
 */
export class MigrationCache implements CacheInterface {
  constructor(
    private primary: CacheInterface,
    private secondary: CacheInterface
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    // Try primary first
    const primaryValue = await this.primary.get<T>(key);
    if (primaryValue !== undefined) {
      return primaryValue;
    }

    // Fall back to secondary
    const secondaryValue = await this.secondary.get<T>(key);
    if (secondaryValue !== undefined) {
      // Backfill to primary
      await this.primary.set(key, secondaryValue);
    }

    return secondaryValue;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    // Write to both caches
    const [primaryResult, secondaryResult] = await Promise.all([
      this.primary.set(key, value, ttl),
      this.secondary.set(key, value, ttl)
    ]);

    return primaryResult || secondaryResult;
  }

  async del(keys: string | string[]): Promise<number> {
    // Delete from both caches
    const [primaryResult, secondaryResult] = await Promise.all([
      this.primary.del(keys),
      this.secondary.del(keys)
    ]);

    return Math.max(primaryResult, secondaryResult);
  }

  async flush(): Promise<void> {
    // Flush both caches
    await Promise.all([
      this.primary.flush(),
      this.secondary.flush()
    ]);
  }

  async getStats(): Promise<any> {
    const [primaryStats, secondaryStats] = await Promise.all([
      this.primary.getStats(),
      this.secondary.getStats()
    ]);

    return {
      primary: primaryStats,
      secondary: secondaryStats
    };
  }
}

/**
 * Create a migration cache that uses both NodeCache and Redis
 * Useful for gradual migration
 */
export function createMigrationCache(): CacheInterface {
  const nodeCacheWrapper = new AsyncCacheWrapper(nodeCache);
  const redisInstance = redisCache;

  logger.log('Creating migration cache (NodeCache + Redis)');
  return new MigrationCache(redisInstance, nodeCacheWrapper);
}