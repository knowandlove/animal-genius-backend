import type { Profile } from '@shared/schema';
import { db } from '../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCache } from '../lib/cache-factory';
import { CONFIG } from '../config/constants';

const cache = getCache();
const CACHE_TTL = CONFIG.CACHE.PROFILE_TTL;

/**
 * Get profile with caching
 * @param userId User ID to fetch profile for
 * @returns Profile or null if not found
 */
export async function getCachedProfile(userId: string): Promise<Profile | null> {
  const cacheKey = `profile:${userId}`;
  
  // Try to get from cache first
  const cached = await cache.get<Profile>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from database
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  
  if (!profile) {
    return null;
  }
  
  // Cache the result
  await cache.set(cacheKey, profile, CACHE_TTL);
  
  return profile;
}

/**
 * Invalidate cached profile
 * @param userId User ID to invalidate
 */
export async function invalidateProfile(userId: string): Promise<void> {
  const cacheKey = `profile:${userId}`;
  await cache.del(cacheKey);
}

/**
 * Clear all cached profiles
 */
export async function clearProfileCache(): Promise<void> {
  await cache.flush();
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  const stats = await cache.getStats();
  return {
    ...stats,
    ttl: CACHE_TTL
  };
}