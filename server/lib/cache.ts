/**
 * Simple in-memory cache implementation
 * Used when Redis is not available
 */

interface CacheEntry<T> {
  value: T;
  expires?: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private timers = new Map<string, NodeJS.Timeout>();

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (entry.expires && Date.now() > entry.expires) {
      this.del(key);
      return undefined;
    }

    return entry.value;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    // Clear existing timer if any
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }

    const entry: CacheEntry<T> = { value };
    
    if (ttl) {
      entry.expires = Date.now() + ttl * 1000;
      
      // Set timer to clean up expired entry
      const timer = setTimeout(() => {
        this.del(key);
      }, ttl * 1000);
      
      this.timers.set(key, timer);
    }

    this.cache.set(key, entry);
    return true;
  }

  del(keys: string | string[]): number {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    let deleted = 0;

    for (const key of keysArray) {
      if (this.cache.delete(key)) {
        deleted++;
      }
      
      // Clear timer if exists
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }

    return deleted;
  }

  flush(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
  }

  getStats(): any {
    let validEntries = 0;
    const now = Date.now();

    for (const [, entry] of this.cache) {
      if (!entry.expires || entry.expires > now) {
        validEntries++;
      }
    }

    return {
      keys: validEntries,
      hits: 0, // Not tracking in simple implementation
      misses: 0,
      ksize: this.cache.size,
      vsize: 0 // Not tracking memory size
    };
  }
}

// Export singleton instance
const cache = new SimpleCache();

export function get<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function set<T>(key: string, value: T, ttl?: number): boolean {
  return cache.set(key, value, ttl);
}

export function del(keys: string | string[]): number {
  return cache.del(keys);
}

export function flush(): void {
  return cache.flush();
}

export function getStats(): any {
  return cache.getStats();
}