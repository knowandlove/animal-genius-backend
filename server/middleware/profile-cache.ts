import type { Profile } from '@shared/schema';
import { db } from '../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Simple in-memory cache for profiles
const profileCache = new Map<string, {
  profile: Profile;
  timestamp: number;
  ttl: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Limit cache size

/**
 * Get profile with caching
 * @param userId User ID to fetch profile for
 * @returns Profile or null if not found
 */
export async function getCachedProfile(userId: string): Promise<Profile | null> {
  const now = Date.now();
  const cached = profileCache.get(userId);
  
  // Check if cached and not expired
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return cached.profile;
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
  profileCache.set(userId, {
    profile,
    timestamp: now,
    ttl: CACHE_TTL
  });
  
  // Simple cache size management - Maps preserve insertion order
  if (profileCache.size > MAX_CACHE_SIZE) {
    // Remove oldest 10% of entries (first inserted)
    const toRemoveCount = Math.floor(profileCache.size * 0.1) || 1;
    const keys = profileCache.keys();
    for (let i = 0; i < toRemoveCount; i++) {
      const keyToRemove = keys.next().value;
      if (keyToRemove) {
        profileCache.delete(keyToRemove);
      }
    }
  }
  
  return profile;
}

/**
 * Invalidate cached profile
 * @param userId User ID to invalidate
 */
export function invalidateProfile(userId: string): void {
  profileCache.delete(userId);
}

/**
 * Clear all cached profiles
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: profileCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL
  };
}