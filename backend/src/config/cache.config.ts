import { CacheService } from '../services/cache.service';

// Initialize cache on application startup
export async function initializeCache(): Promise<void> {
  try {
    console.log('Initializing Redis cache...');
    await CacheService.initialize();
    console.log('Redis cache initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Redis cache:', error);
    console.warn('Application will continue without caching');
  }
}

// Gracefully close cache connection
export async function closeCache(): Promise<void> {
  try {
    console.log('Closing Redis cache connection...');
    await CacheService.close();
    console.log('Redis cache connection closed');
  } catch (error) {
    console.error('Error closing Redis cache:', error);
  }
}

// Health check for cache
export async function checkCacheHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
}> {
  try {
    // Try a simple set/get operation
    const testKey = 'health:check';
    const testValue = Date.now().toString();
    
    await CacheService.set(testKey, testValue, 10);
    const retrieved = await CacheService.get(testKey);
    
    if (retrieved === testValue) {
      await CacheService.delete(testKey);
      return {
        status: 'healthy',
        message: 'Redis cache is operational'
      };
    }
    
    return {
      status: 'unhealthy',
      message: 'Redis cache read/write test failed'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Redis cache error: ${error}`
    };
  }
}

// Cache configuration for different environments
export const cacheConfig = {
  development: {
    defaultTTL: 60, // 1 minute
    enableHttpCache: true,
    enableQueryCache: true,
    logCacheHits: true
  },
  production: {
    defaultTTL: 300, // 5 minutes
    enableHttpCache: true,
    enableQueryCache: true,
    logCacheHits: false
  },
  test: {
    defaultTTL: 1, // 1 second
    enableHttpCache: false,
    enableQueryCache: false,
    logCacheHits: false
  }
};

// Get current environment cache config
export function getCacheConfig() {
  const env = process.env.NODE_ENV || 'development';
  return cacheConfig[env as keyof typeof cacheConfig] || cacheConfig.development;
}