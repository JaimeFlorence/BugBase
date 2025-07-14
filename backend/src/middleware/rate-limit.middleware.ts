import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import { AppError } from './errorHandler';

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  skip?: (req: Request) => boolean;
  requestWasSuccessful?: (req: Request, res: Response) => boolean;
  store?: RateLimitStore;
}

interface RateLimitStore {
  increment(key: string): Promise<RateLimitInfo>;
  decrement(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

interface RateLimitInfo {
  totalHits: number;
  resetTime: Date;
}

// In-memory store (fallback when Redis is not available)
class MemoryStore implements RateLimitStore {
  private hits = new Map<string, { count: number; resetTime: number }>();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), windowMs);
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const resetTime = now + this.windowMs;
    
    const current = this.hits.get(key);
    
    if (!current || current.resetTime < now) {
      this.hits.set(key, { count: 1, resetTime });
      return { totalHits: 1, resetTime: new Date(resetTime) };
    }
    
    current.count++;
    return { totalHits: current.count, resetTime: new Date(current.resetTime) };
  }

  async decrement(key: string): Promise<void> {
    const current = this.hits.get(key);
    if (current && current.count > 0) {
      current.count--;
    }
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.hits.entries()) {
      if (value.resetTime < now) {
        this.hits.delete(key);
      }
    }
  }
}

// Redis store for distributed rate limiting
class RedisStore implements RateLimitStore {
  private client: RedisClientType;
  private windowMs: number;

  constructor(client: RedisClientType, windowMs: number) {
    this.client = client;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const multi = this.client.multi();
    const ttl = Math.ceil(this.windowMs / 1000);
    
    multi.incr(key);
    multi.expire(key, ttl);
    
    const results = await multi.exec();
    const totalHits = results[0] as number;
    
    return {
      totalHits,
      resetTime: new Date(Date.now() + this.windowMs),
    };
  }

  async decrement(key: string): Promise<void> {
    const current = await this.client.get(key);
    if (current && parseInt(current) > 0) {
      await this.client.decr(key);
    }
  }

  async reset(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// Enhanced rate limiter with multiple strategies
export function rateLimit(options: RateLimitOptions = {}) {
  const config = {
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100,
    message: options.message || 'Too many requests, please try again later.',
    standardHeaders: options.standardHeaders ?? true,
    legacyHeaders: options.legacyHeaders ?? false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    skipFailedRequests: options.skipFailedRequests ?? false,
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    handler: options.handler || defaultHandler,
    skip: options.skip || (() => false),
    requestWasSuccessful: options.requestWasSuccessful || defaultRequestWasSuccessful,
    store: options.store || new MemoryStore(options.windowMs || 15 * 60 * 1000),
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if we should skip this request
    if (config.skip(req)) {
      return next();
    }

    const key = config.keyGenerator(req);
    
    try {
      const rateLimitInfo = await config.store.increment(key);
      
      // Set headers
      if (config.standardHeaders) {
        res.setHeader('RateLimit-Limit', config.max);
        res.setHeader('RateLimit-Remaining', Math.max(0, config.max - rateLimitInfo.totalHits));
        res.setHeader('RateLimit-Reset', rateLimitInfo.resetTime.toISOString());
      }
      
      if (config.legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', config.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - rateLimitInfo.totalHits));
        res.setHeader('X-RateLimit-Reset', rateLimitInfo.resetTime.toISOString());
      }
      
      // Check if limit exceeded
      if (rateLimitInfo.totalHits > config.max) {
        if (config.standardHeaders) {
          res.setHeader('Retry-After', Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000));
        }
        return config.handler(req, res);
      }
      
      // Add cleanup logic for successful/failed requests
      res.on('finish', async () => {
        const wasSuccessful = config.requestWasSuccessful(req, res);
        
        if ((config.skipSuccessfulRequests && wasSuccessful) ||
            (config.skipFailedRequests && !wasSuccessful)) {
          await config.store.decrement(key);
        }
      });
      
      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // Fail open - don't block requests if rate limiting fails
      next();
    }
  };
}

// Default key generator
function defaultKeyGenerator(req: Request): string {
  const user = (req as any).user;
  if (user?.id) {
    return `rate-limit:user:${user.id}`;
  }
  
  // Fallback to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `rate-limit:ip:${ip}`;
}

// Default handler for rate limit exceeded
function defaultHandler(req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later.',
  });
}

// Default success checker
function defaultRequestWasSuccessful(req: Request, res: Response): boolean {
  return res.statusCode < 400;
}

// Sliding window rate limiter (more accurate but more complex)
export function slidingWindowRateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 100;
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  
  // Use Redis for sliding window if available
  const store = new Map<string, number[]>();
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create timestamp array for this key
    let timestamps = store.get(key) || [];
    
    // Remove old timestamps outside the window
    timestamps = timestamps.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (timestamps.length >= max) {
      const oldestTimestamp = timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
      
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(oldestTimestamp + windowMs).toISOString());
      
      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter,
      });
    }
    
    // Add current timestamp
    timestamps.push(now);
    store.set(key, timestamps);
    
    // Set headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - timestamps.length);
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    next();
  };
}

// Different rate limits for different endpoints
export const rateLimiters = {
  // Strict limit for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  
  // Moderate limit for API endpoints
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
  }),
  
  // Lenient limit for read operations
  read: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    skipSuccessfulRequests: true, // Don't count successful reads
  }),
  
  // Strict limit for write operations
  write: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    skipFailedRequests: true, // Don't count failed writes
  }),
  
  // Very strict limit for file uploads
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: 'Upload limit exceeded, please try again later.',
  }),
};

// Dynamic rate limiting based on user tier
export function tieredRateLimit(getTier: (req: Request) => Promise<'free' | 'pro' | 'enterprise'>) {
  const limits = {
    free: { windowMs: 60 * 60 * 1000, max: 100 },
    pro: { windowMs: 60 * 60 * 1000, max: 1000 },
    enterprise: { windowMs: 60 * 60 * 1000, max: 10000 },
  };
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const tier = await getTier(req);
    const limit = limits[tier];
    
    const limiter = rateLimit({
      windowMs: limit.windowMs,
      max: limit.max,
      keyGenerator: (req) => {
        const user = (req as any).user;
        return `rate-limit:${tier}:${user?.id || req.ip}`;
      },
    });
    
    return limiter(req, res, next);
  };
}

// IP-based blocking for suspicious activity
export class IPBlocker {
  private blockedIPs = new Set<string>();
  private suspiciousActivity = new Map<string, number>();
  
  constructor(
    private threshold = 10, // Number of suspicious requests before blocking
    private blockDuration = 24 * 60 * 60 * 1000 // 24 hours
  ) {}
  
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      
      // Check if IP is blocked
      if (this.blockedIPs.has(ip)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }
      
      // Track suspicious activity
      res.on('finish', () => {
        // Consider 401, 403, and repeated 404s as suspicious
        if (res.statusCode === 401 || res.statusCode === 403 || 
            (res.statusCode === 404 && req.path.includes('..'))) {
          const count = (this.suspiciousActivity.get(ip) || 0) + 1;
          this.suspiciousActivity.set(ip, count);
          
          if (count >= this.threshold) {
            this.blockIP(ip);
          }
        }
      });
      
      next();
    };
  }
  
  blockIP(ip: string): void {
    this.blockedIPs.add(ip);
    this.suspiciousActivity.delete(ip);
    
    // Automatically unblock after duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
    }, this.blockDuration);
    
    console.warn(`Blocked IP ${ip} for suspicious activity`);
  }
  
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.suspiciousActivity.delete(ip);
  }
  
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }
}