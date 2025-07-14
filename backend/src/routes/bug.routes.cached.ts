import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { BugController } from '../controllers/bug.controller';
import { 
  httpCache, 
  invalidateCache, 
  cacheConfigs, 
  etag,
  rateLimitWithCache 
} from '../middleware/cache.middleware';
import { CacheService } from '../services/cache.service';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply rate limiting to prevent abuse
router.use(rateLimitWithCache({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each user to 100 requests per windowMs
}));

// Bug CRUD operations with caching

// POST /api/bugs - Create bug (invalidates caches)
router.post('/', 
  invalidateCache((req) => [
    'bugs:*',
    `project:${req.body.projectId}:*`,
    'stats:*'
  ]),
  BugController.createBug
);

// GET /api/bugs - Get bugs list (cached)
router.get('/', 
  cacheConfigs.bugList,
  etag(),
  BugController.getBugs
);

// GET /api/bugs/statistics - Get bug statistics (cached)
router.get('/statistics', 
  cacheConfigs.bugStatistics,
  BugController.getBugStatistics
);

// GET /api/bugs/:id - Get bug by ID (cached)
router.get('/:id', 
  cacheConfigs.bugDetails,
  etag(),
  BugController.getBugById
);

// PUT /api/bugs/:id - Update bug (invalidates caches)
router.put('/:id', 
  invalidateCache((req) => [
    `bug:${req.params.id}:*`,
    'bugs:*',
    'stats:*',
    `project:*:bugs:*`
  ]),
  BugController.updateBug
);

// DELETE /api/bugs/:id - Delete bug (invalidates caches)
router.delete('/:id', 
  invalidateCache((req) => [
    `bug:${req.params.id}:*`,
    'bugs:*',
    'stats:*',
    `project:*:bugs:*`
  ]),
  BugController.deleteBug
);

// Bug watchers with cache invalidation

// POST /api/bugs/:id/watchers - Add watcher
router.post('/:id/watchers', 
  invalidateCache((req) => [
    `bug:${req.params.id}:*`
  ]),
  BugController.addWatcher
);

// DELETE /api/bugs/:id/watchers/:userId - Remove watcher
router.delete('/:id/watchers/:userId', 
  invalidateCache((req) => [
    `bug:${req.params.id}:*`
  ]),
  BugController.removeWatcher
);

// Advanced caching endpoints

// GET /api/bugs/cache/warm - Warm cache for current user
router.get('/cache/warm', async (req: any, res, next) => {
  try {
    const { BugServiceCached } = await import('../services/bug.service.cached');
    await BugServiceCached.warmCache(req.user.id);
    
    res.json({
      success: true,
      message: 'Cache warmed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/bugs/cache/clear - Clear bug-related caches (admin only)
router.delete('/cache/clear', async (req: any, res, next) => {
  try {
    // Check if user is admin (implement your own admin check)
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, error: 'Admin access required' });
    // }
    
    await CacheService.deletePattern('bugs:*');
    await CacheService.deletePattern('bug:*');
    await CacheService.deletePattern('stats:*');
    
    res.json({
      success: true,
      message: 'Bug caches cleared successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/bugs/cache/stats - Get cache statistics (admin only)
router.get('/cache/stats', async (req: any, res, next) => {
  try {
    // This is a placeholder - implement based on your Redis setup
    res.json({
      success: true,
      data: {
        message: 'Cache statistics endpoint - implement based on Redis INFO command'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;