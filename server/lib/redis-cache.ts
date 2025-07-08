/**
 * Redis cache implementation
 * This provides the same interface as cache.ts but uses Redis
 * for distributed caching across multiple servers
 */

import { createClient, RedisClientType } from 'redis';
import { createSecureLogger } from '../utils/secure-logger';
import { CONFIG } from '../config/constants';

const logger = createSecureLogger('RedisCache');

// Default TTL in seconds
const DEFAULT_TTL = CONFIG.CACHE.DEFAULT_TTL;

class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    // Only connect if Redis is enabled
    if (process.env.CACHE_TYPE === 'redis') {
      this.connect();
    }
  }

  private async connect(): Promise<void> {
    // Only connect once
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._doConnect();
    return this.connectionPromise;
  }

  private async _doConnect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > CONFIG.CACHE.REDIS_MAX_RECONNECT_ATTEMPTS) {
              logger.error(`Redis reconnection failed after ${CONFIG.CACHE.REDIS_MAX_RECONNECT_ATTEMPTS} attempts`);
              return new Error('Too many reconnection attempts');
            }
            return Math.min(retries * CONFIG.CACHE.REDIS_RECONNECT_BASE_DELAY, CONFIG.CACHE.REDIS_RECONNECT_MAX_DELAY);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        logger.log('Redis client connected and ready');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.client = null;
      throw error;
    }
  }

  /**
   * Retrieves a value from the cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      if (!this.isConnected || !this.client) {
        logger.debug('Redis not connected, returning undefined');
        return undefined;
      }

      const value = await this.client.get(key);
      if (!value) return undefined;

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error:', error);
      return undefined;
    }
  }

  /**
   * Stores a value in the cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        logger.debug('Redis not connected, skipping set');
        return false;
      }

      const stringValue = JSON.stringify(value);
      const options = ttl ? { EX: ttl } : { EX: DEFAULT_TTL };
      
      const result = await this.client.set(key, stringValue, options);
      return result === 'OK';
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  /**
   * Deletes a key or keys from the cache
   */
  async del(keys: string | string[]): Promise<number> {
    try {
      if (!this.isConnected || !this.client) {
        logger.debug('Redis not connected, skipping delete');
        return 0;
      }

      const keysArray = Array.isArray(keys) ? keys : [keys];
      if (keysArray.length === 0) return 0;

      return await this.client.del(keysArray);
    } catch (error) {
      logger.error('Redis del error:', error);
      return 0;
    }
  }

  /**
   * Flushes the entire cache
   */
  async flush(): Promise<void> {
    try {
      if (!this.isConnected || !this.client) {
        logger.debug('Redis not connected, skipping flush');
        return;
      }

      await this.client.flushAll();
    } catch (error) {
      logger.error('Redis flush error:', error);
    }
  }

  /**
   * Gets cache statistics
   */
  async getStats(): Promise<any> {
    try {
      if (!this.isConnected || !this.client) {
        return { connected: false };
      }

      const info = await this.client.info('stats');
      const dbSize = await this.client.dbSize();

      return {
        connected: true,
        dbSize,
        info
      };
    } catch (error) {
      logger.error('Redis stats error:', error);
      return { connected: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        logger.log('Redis client disconnected');
      }
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }

  /**
   * Add member to a set
   */
  async sadd(key: string, member: string): Promise<number> {
    try {
      if (!this.isConnected || !this.client) {
        logger.debug('Redis not connected, skipping sadd');
        return 0;
      }

      return await this.client.sAdd(key, member);
    } catch (error) {
      logger.error('Redis sadd error:', error);
      return 0;
    }
  }

  /**
   * Remove member from a set
   */
  async srem(key: string, member: string): Promise<number> {
    try {
      if (!this.isConnected || !this.client) {
        logger.debug('Redis not connected, skipping srem');
        return 0;
      }

      return await this.client.sRem(key, member);
    } catch (error) {
      logger.error('Redis srem error:', error);
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      if (!this.isConnected || !this.client) {
        logger.debug('Redis not connected, returning empty array');
        return [];
      }

      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Redis smembers error:', error);
      return [];
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const redisCache = new RedisCache();

// Register with cleanup manager if available
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  import('./resource-cleanup').then(({ cleanupManager }) => {
    cleanupManager.register({
      name: 'redis-cache',
      priority: 50, // Clean up before database
      handler: async () => {
        await redisCache.disconnect();
      }
    });
  }).catch(() => {
    // Fallback to direct process handlers if cleanup manager not available
    process.on('SIGTERM', async () => {
      await redisCache.disconnect();
    });
    
    process.on('SIGINT', async () => {
      await redisCache.disconnect();
    });
  });
}