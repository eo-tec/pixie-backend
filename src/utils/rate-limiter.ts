interface RateLimitConfig {
  [key: string]: {
    maxRequests: number;
    windowMs: number;
  };
}

const rateLimitConfig: RateLimitConfig = {
  draw_pixel: {
    maxRequests: 60, // 60 pixels per second
    windowMs: 1000   // 1 second
  },
  draw_stroke: {
    maxRequests: 30, // 30 strokes per second
    windowMs: 1000   // 1 second
  },
  clear_canvas: {
    maxRequests: 5,  // 5 clears per minute
    windowMs: 60000  // 1 minute
  }
};

interface UserRateLimit {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, UserRateLimit> = new Map();

  consume(userId: string, action: string): boolean {
    const config = rateLimitConfig[action];
    if (!config) {
      return true; // No rate limit configured
    }

    const key = `${userId}:${action}`;
    const now = Date.now();
    
    const userLimit = this.limits.get(key);
    
    if (!userLimit) {
      // First request
      this.limits.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return true;
    }

    if (now > userLimit.resetTime) {
      // Reset the limit
      userLimit.count = 1;
      userLimit.resetTime = now + config.windowMs;
      return true;
    }

    if (userLimit.count >= config.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    userLimit.count++;
    return true;
  }

  // Clean up expired entries every 5 minutes
  private cleanupExpired() {
    const now = Date.now();
    for (const [key, limit] of this.limits.entries()) {
      if (now > limit.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  constructor() {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }
}

export const rateLimiter = new RateLimiter();