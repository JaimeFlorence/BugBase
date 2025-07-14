import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

// Generate cache key from request
function generateCacheKey(req: Request): string {
  const { method, originalUrl, query, params } = req;
  const userId = (req as any).user?.id || 'anonymous';
  
  const keyData = {
    method,
    url: originalUrl,
    query,
    params,
    userId
  };
  
  // Create a hash of the key data for a shorter key
  const hash = crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  return `http:${method}:${hash}`;
}

// HTTP Cache middleware factory
export function httpCache(options: CacheOptions = {}) {
  const {
    ttl = 60, // Default 1 minute
    keyGenerator = generateCacheKey,
    condition = (req) => req.method === 'GET'
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if caching should be applied
    if (!condition(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);

    // Try to get from cache
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      // Add cache headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Key', cacheKey);
      
      // Check if it's a JSON response
      if (typeof cached === 'object') {
        return res.json(cached);
      }
      
      return res.send(cached);
    }

    // Store original send/json methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override json method to cache response
    res.json = function(data: any) {
      // Cache the response
      CacheService.set(cacheKey, data, ttl).catch(err => {
        console.error('Cache set error:', err);
      });

      // Add cache headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);
      res.setHeader('Cache-Control', `private, max-age=${ttl}`);

      return originalJson(data);
    };

    // Override send method to cache response
    res.send = function(data: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        CacheService.set(cacheKey, data, ttl).catch(err => {
          console.error('Cache set error:', err);
        });
      }

      // Add cache headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      return originalSend(data);
    };

    next();
  };
}

// Cache invalidation middleware
export function invalidateCache(patterns: string[] | ((req: Request) => string[])) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override methods to invalidate cache after successful response
    const invalidatePatterns = async () => {
      const patternsToInvalidate = typeof patterns === 'function' ? patterns(req) : patterns;
      
      for (const pattern of patternsToInvalidate) {
        await CacheService.deletePattern(pattern);
      }
    };

    res.json = function(data: any) {
      // Only invalidate on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidatePatterns().catch(err => {
          console.error('Cache invalidation error:', err);
        });
      }
      
      return originalJson(data);
    };

    res.send = function(data: any) {
      // Only invalidate on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidatePatterns().catch(err => {
          console.error('Cache invalidation error:', err);
        });
      }
      
      return originalSend(data);
    };

    next();
  };
}

// Specific cache configurations for different endpoints
export const cacheConfigs = {
  // Bug list endpoint
  bugList: httpCache({
    ttl: CacheService.TTL.SEARCH_RESULTS,
    condition: (req) => req.method === 'GET' && req.path === '/'
  }),

  // Bug details endpoint
  bugDetails: httpCache({
    ttl: CacheService.TTL.BUG_DETAILS,
    condition: (req) => req.method === 'GET' && req.params.id
  }),

  // Bug statistics endpoint
  bugStatistics: httpCache({
    ttl: CacheService.TTL.BUG_STATISTICS,
    condition: (req) => req.method === 'GET' && req.path.includes('statistics')
  }),

  // Project metadata
  projectData: httpCache({
    ttl: CacheService.TTL.PROJECT_METADATA,
    condition: (req) => req.method === 'GET'
  }),

  // User data
  userData: httpCache({
    ttl: CacheService.TTL.USER_PERMISSIONS,
    condition: (req) => req.method === 'GET'
  })
};

// ETag support for conditional requests
export function etag() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function(data: any) {
      // Generate ETag from response data
      const etag = crypto
        .createHash('md5')
        .update(JSON.stringify(data))
        .digest('hex');

      // Set ETag header
      res.setHeader('ETag', `"${etag}"`);

      // Check if client has matching ETag
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === `"${etag}"`) {
        res.status(304).end();
        return res;
      }

      return originalJson(data);
    };

    next();
  };
}

// Rate limiting with cache
export function rateLimitWithCache(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, max, keyGenerator = (req) => (req as any).user?.id || req.ip } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${keyGenerator(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get current count from cache
    const current = await CacheService.get<number>(key) || 0;

    if (current >= max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.'
      });
    }

    // Increment counter
    await CacheService.set(key, current + 1, Math.ceil(windowMs / 1000));

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', (max - current - 1).toString());
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    next();
  };
}