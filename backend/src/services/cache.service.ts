import { createClient, RedisClientType } from 'redis';
import { AppError } from '../middleware/errorHandler';

export class CacheService {
  private static client: RedisClientType | null = null;
  private static isConnected = false;

  // Cache TTL configurations (in seconds)
  static readonly TTL = {
    USER_PERMISSIONS: 300,      // 5 minutes
    PROJECT_METADATA: 600,      // 10 minutes
    BUG_STATISTICS: 60,         // 1 minute
    SEARCH_RESULTS: 30,         // 30 seconds
    BUG_DETAILS: 120,          // 2 minutes
    USER_PROJECTS: 300,        // 5 minutes
    NOTIFICATIONS_COUNT: 10,    // 10 seconds
  };

  // Initialize Redis connection
  static async initialize(): Promise<void> {
    if (this.client) return;

    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      // Don't throw - allow app to run without cache
      this.client = null;
      this.isConnected = false;
    }
  }

  // Get from cache
  static async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  // Set in cache with TTL
  static async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  // Delete from cache
  static async delete(key: string | string[]): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      if (Array.isArray(key)) {
        if (key.length > 0) {
          await this.client.del(key);
        }
      } else {
        await this.client.del(key);
      }
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  // Delete by pattern
  static async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  // Cache wrapper for functions
  static async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  // Invalidate related caches
  static async invalidateBugCaches(bugId: string, projectId?: string): Promise<void> {
    const keysToDelete = [
      `bug:${bugId}`,
      `bug:${bugId}:*`,
      `bugs:*`, // All bug lists
      `stats:*`, // All statistics
    ];

    if (projectId) {
      keysToDelete.push(
        `project:${projectId}:bugs`,
        `project:${projectId}:stats`
      );
    }

    for (const pattern of keysToDelete) {
      await this.deletePattern(pattern);
    }
  }

  static async invalidateProjectCaches(projectId: string): Promise<void> {
    const patterns = [
      `project:${projectId}:*`,
      `bugs:project:${projectId}:*`,
      `user:*:projects`, // Invalidate all user project lists
    ];

    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
  }

  static async invalidateUserCaches(userId: string): Promise<void> {
    const patterns = [
      `user:${userId}:*`,
      `permissions:${userId}:*`,
    ];

    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
  }

  // Generate cache keys
  static keys = {
    bugDetails: (bugId: string) => `bug:${bugId}`,
    bugList: (filters: string, page: number, limit: number) => 
      `bugs:${filters}:page:${page}:limit:${limit}`,
    projectBugs: (projectId: string, filters: string, page: number) => 
      `project:${projectId}:bugs:${filters}:${page}`,
    userProjects: (userId: string) => `user:${userId}:projects`,
    userPermissions: (userId: string, projectId: string) => 
      `permissions:${userId}:project:${projectId}`,
    bugStatistics: (projectId?: string) => 
      projectId ? `stats:project:${projectId}` : 'stats:global',
    searchResults: (query: string, filters: string, page: number) => 
      `search:${query}:${filters}:${page}`,
    notificationCount: (userId: string) => `notifications:${userId}:count`,
    projectMetadata: (projectId: string) => `project:${projectId}:metadata`,
  };

  // Close Redis connection
  static async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export cache decorator for methods
export function Cacheable(ttl: number, keyGenerator: (...args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator(...args);
      
      // Try cache first
      const cached = await CacheService.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);
      
      // Cache result
      await CacheService.set(cacheKey, result, ttl);
      
      return result;
    };

    return descriptor;
  };
}

// Export cache invalidation decorator
export function InvalidatesCache(patterns: ((...args: any[]) => string[])) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Call original method
      const result = await originalMethod.apply(this, args);
      
      // Invalidate caches
      const keysToInvalidate = patterns(...args);
      for (const pattern of keysToInvalidate) {
        await CacheService.deletePattern(pattern);
      }
      
      return result;
    };

    return descriptor;
  };
}