/**
 * Cache abstraction layer
 * This module provides a simple interface for caching that can be easily
 * swapped out for Redis or other solutions in the future.
 * 
 * As recommended by Gemini (Technical Director)
 */

import NodeCache from 'node-cache';

// Initialize the cache with our desired settings
// stdTTL: 300s (5 minutes) as a default
// checkperiod: 120s (2 minutes) to automatically prune expired keys
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

/**
 * Retrieves a value from the cache
 * @param key The cache key
 * @returns The cached value or undefined if not found
 */
export function get<T>(key: string): T | undefined {
  try {
    return cache.get<T>(key);
  } catch (error) {
    console.error('Cache get error:', error);
    return undefined;
  }
}

/**
 * Stores a value in the cache
 * @param key The cache key
 * @param value The value to store
 * @param ttl Optional time-to-live in seconds. Overrides the default
 * @returns True if the item was successfully set
 */
export function set<T>(key: string, value: T, ttl?: number): boolean {
  try {
    return cache.set(key, value, ttl);
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

/**
 * Deletes a key or keys from the cache
 * @param key A single key or an array of keys to delete
 * @returns The number of keys deleted
 */
export function del(key: string | string[]): number {
  try {
    return cache.del(key);
  } catch (error) {
    console.error('Cache del error:', error);
    return 0;
  }
}

/**
 * Flushes the entire cache. Useful for testing
 */
export function flush(): void {
  try {
    cache.flushAll();
  } catch (error) {
    console.error('Cache flush error:', error);
  }
}

/**
 * Gets cache statistics
 * @returns Object with cache statistics
 */
export function getStats() {
  return cache.getStats();
}

// Log cache initialization
console.log('✅ Cache system initialized with 5-minute TTL');
