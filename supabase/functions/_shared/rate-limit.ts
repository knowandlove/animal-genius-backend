/**
 * Rate limiting utilities for Supabase Edge Functions
 * Uses Upstash Redis for distributed rate limiting
 */

interface RateLimitConfig {
  /** Number of allowed requests */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Optional prefix for Redis keys */
  prefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

/**
 * Rate limiter using Upstash Redis
 */
export class RateLimiter {
  private redisUrl: string;
  private redisToken: string;

  constructor() {
    this.redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') || '';
    this.redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';
    
    if (!this.redisUrl || !this.redisToken) {
      console.warn('Upstash Redis not configured - rate limiting disabled');
    }
  }

  /**
   * Check if a request is allowed under the rate limit
   */
  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    // If Redis not configured, allow all requests (development mode)
    if (!this.redisUrl || !this.redisToken) {
      return { allowed: true, remaining: config.limit, reset: Date.now() + config.window * 1000 };
    }

    const fullKey = config.prefix ? `${config.prefix}:${key}` : key;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    try {
      // Use Redis sorted set to track requests
      // Score is the timestamp, value is a unique ID
      const requestId = `${now}-${Math.random()}`;
      
      // Pipeline commands for atomic operation
      const pipeline = [
        // Remove old entries outside the window
        ['ZREMRANGEBYSCORE', fullKey, '-inf', windowStart],
        // Add current request
        ['ZADD', fullKey, now, requestId],
        // Count requests in window
        ['ZCOUNT', fullKey, windowStart, '+inf'],
        // Set expiry
        ['EXPIRE', fullKey, config.window + 1]
      ];

      const response = await fetch(`${this.redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipeline),
      });

      if (!response.ok) {
        console.error('Redis error:', await response.text());
        // On Redis error, fail open (allow request)
        return { allowed: true, remaining: config.limit, reset: Date.now() + config.window * 1000 };
      }

      const results = await response.json();
      const count = results[2]?.result || 0;
      
      const allowed = count <= config.limit;
      const remaining = Math.max(0, config.limit - count);
      const reset = (now + config.window) * 1000;

      // If over limit, remove the request we just added
      if (!allowed) {
        await fetch(`${this.redisUrl}/zrem/${fullKey}/${requestId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.redisToken}`,
          },
        });
      }

      return { allowed, remaining, reset };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // On error, fail open (allow request)
      return { allowed: true, remaining: config.limit, reset: Date.now() + config.window * 1000 };
    }
  }

  /**
   * Get IP address from request
   */
  static getClientIp(req: Request): string {
    // Check various headers for IP
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    
    const realIp = req.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }
    
    // Fallback to a generic identifier
    return 'unknown';
  }
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Student login: 5 attempts per minute per IP, 10 per passport code per hour
  studentLogin: {
    perIp: { limit: 5, window: 60, prefix: 'login:ip' },
    perPassport: { limit: 10, window: 3600, prefix: 'login:passport' },
  },
  
  // Quiz submission: 10 per IP per minute, 50 per class per hour
  quizSubmit: {
    perIp: { limit: 10, window: 60, prefix: 'quiz:ip' },
    perClass: { limit: 50, window: 3600, prefix: 'quiz:class' },
  },
  
  // Eligibility check: 20 per IP per minute
  eligibilityCheck: {
    perIp: { limit: 20, window: 60, prefix: 'elig:ip' },
  },
} as const;

/**
 * Helper to send rate limit headers
 */
export function setRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', result.allowed ? '1' : '0');
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.reset.toString());
}

/**
 * Helper to create rate limit error response
 */
export function rateLimitErrorResponse(result: RateLimitResult, message?: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  
  setRateLimitHeaders(headers, result);
  
  return new Response(
    JSON.stringify({
      error: message || 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    }),
    { 
      status: 429, 
      headers,
    }
  );
}