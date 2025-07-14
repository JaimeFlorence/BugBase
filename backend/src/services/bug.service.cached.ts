import { PrismaClient } from '@prisma/client';
import { Bug, BugStatus, BugPriority, BugSeverity } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { CacheService, Cacheable, InvalidatesCache } from './cache.service';
import { BugServiceOptimized } from './bug.service.optimized';

const prisma = new PrismaClient();

interface CreateBugData {
  projectId: string;
  title: string;
  description: string;
  priority?: BugPriority;
  severity?: BugSeverity;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  versionFound?: string;
  environment?: string;
  customFields?: Record<string, any>;
}

interface UpdateBugData {
  title?: string;
  description?: string;
  status?: BugStatus;
  priority?: BugPriority;
  severity?: BugSeverity;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  versionFound?: string;
  versionFixed?: string;
  environment?: string;
  customFields?: Record<string, any>;
}

interface BugFilters {
  projectId?: string;
  status?: BugStatus;
  priority?: BugPriority;
  severity?: BugSeverity;
  assigneeId?: string;
  reporterId?: string;
  search?: string;
  milestoneId?: string;
  labels?: string[];
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class BugServiceCached extends BugServiceOptimized {
  
  // Create bug with cache invalidation
  @InvalidatesCache((data: CreateBugData) => [
    `bugs:*`,
    `project:${data.projectId}:*`,
    `stats:*`
  ])
  static async createBug(data: CreateBugData, reporterId: string): Promise<Bug> {
    const bug = await super.createBug(data, reporterId);
    
    // Cache the new bug details
    await CacheService.set(
      CacheService.keys.bugDetails(bug.id),
      bug,
      CacheService.TTL.BUG_DETAILS
    );
    
    return bug;
  }

  // Get bug by ID with caching
  static async getBugById(id: string, userId: string, includeComments = true): Promise<Bug | null> {
    const cacheKey = `${CacheService.keys.bugDetails(id)}:user:${userId}:comments:${includeComments}`;
    
    // Try cache first
    const cached = await CacheService.get<Bug>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Get from database
    const bug = await super.getBugById(id, userId, includeComments);
    
    // Cache if found
    if (bug) {
      await CacheService.set(cacheKey, bug, CacheService.TTL.BUG_DETAILS);
    }
    
    return bug;
  }

  // Get bugs with caching
  static async getBugs(
    filters: BugFilters,
    pagination: PaginationOptions,
    userId: string
  ) {
    // Generate cache key based on filters and pagination
    const filterKey = JSON.stringify(filters);
    const cacheKey = `${CacheService.keys.bugList(filterKey, pagination.page || 1, pagination.limit || 20)}:user:${userId}`;
    
    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Get from database
    const result = await super.getBugs(filters, pagination, userId);
    
    // Cache results
    await CacheService.set(cacheKey, result, CacheService.TTL.SEARCH_RESULTS);
    
    return result;
  }

  // Update bug with cache invalidation
  @InvalidatesCache((id: string) => [
    `bug:${id}:*`,
    `bugs:*`,
    `stats:*`
  ])
  static async updateBug(id: string, data: UpdateBugData, userId: string): Promise<Bug> {
    const bug = await super.updateBug(id, data, userId);
    
    // Cache the updated bug
    await CacheService.set(
      CacheService.keys.bugDetails(bug.id),
      bug,
      CacheService.TTL.BUG_DETAILS
    );
    
    // Invalidate project-specific caches
    await CacheService.invalidateBugCaches(id, bug.projectId);
    
    return bug;
  }

  // Delete bug with cache invalidation
  static async deleteBug(id: string, userId: string): Promise<void> {
    // Get bug info before deletion for cache invalidation
    const bug = await prisma.bug.findUnique({
      where: { id },
      select: { id: true, projectId: true }
    });
    
    await super.deleteBug(id, userId);
    
    // Invalidate all related caches
    if (bug) {
      await CacheService.invalidateBugCaches(id, bug.projectId);
    }
  }

  // Get bug statistics with caching
  static async getBugStatistics(projectId?: string, userId?: string) {
    const cacheKey = CacheService.keys.bugStatistics(projectId);
    
    return await CacheService.wrap(
      cacheKey,
      async () => {
        const filters: BugFilters = projectId ? { projectId } : {};
        
        // Get bugs with different statuses in parallel
        const [
          allBugs,
          newBugs,
          inProgressBugs,
          resolvedBugs,
          closedBugs
        ] = await Promise.all([
          super.getBugs(filters, { page: 1, limit: 1 }, userId!),
          super.getBugs({ ...filters, status: BugStatus.NEW }, { page: 1, limit: 1 }, userId!),
          super.getBugs({ ...filters, status: BugStatus.IN_PROGRESS }, { page: 1, limit: 1 }, userId!),
          super.getBugs({ ...filters, status: BugStatus.RESOLVED }, { page: 1, limit: 1 }, userId!),
          super.getBugs({ ...filters, status: BugStatus.CLOSED }, { page: 1, limit: 1 }, userId!)
        ]);
        
        return {
          total: allBugs.pagination.totalCount,
          new: newBugs.pagination.totalCount,
          inProgress: inProgressBugs.pagination.totalCount,
          resolved: resolvedBugs.pagination.totalCount,
          closed: closedBugs.pagination.totalCount,
          open: allBugs.pagination.totalCount - resolvedBugs.pagination.totalCount - closedBugs.pagination.totalCount
        };
      },
      CacheService.TTL.BUG_STATISTICS
    );
  }

  // Cache user's project access
  static async getUserProjects(userId: string) {
    const cacheKey = CacheService.keys.userProjects(userId);
    
    return await CacheService.wrap(
      cacheKey,
      async () => {
        const projects = await prisma.projectMember.findMany({
          where: { userId },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                key: true,
                color: true,
                icon: true
              }
            }
          }
        });
        
        return projects.map(pm => pm.project);
      },
      CacheService.TTL.USER_PROJECTS
    );
  }

  // Cache permission checks
  static async checkUserProjectPermission(userId: string, projectId: string): Promise<boolean> {
    const cacheKey = CacheService.keys.userPermissions(userId, projectId);
    
    return await CacheService.wrap(
      cacheKey,
      async () => {
        const member = await prisma.projectMember.findFirst({
          where: {
            userId,
            projectId
          }
        });
        
        return !!member;
      },
      CacheService.TTL.USER_PERMISSIONS
    );
  }

  // Search bugs with caching
  static async searchBugs(
    query: string,
    filters: BugFilters,
    pagination: PaginationOptions,
    userId: string
  ) {
    const filterKey = JSON.stringify({ query, ...filters });
    const cacheKey = CacheService.keys.searchResults(query, filterKey, pagination.page || 1);
    
    return await CacheService.wrap(
      cacheKey,
      async () => {
        // Add search term to filters
        const searchFilters = {
          ...filters,
          search: query
        };
        
        return await super.getBugs(searchFilters, pagination, userId);
      },
      CacheService.TTL.SEARCH_RESULTS
    );
  }

  // Batch cache warming for frequently accessed data
  static async warmCache(userId: string): Promise<void> {
    try {
      // Warm user projects cache
      await this.getUserProjects(userId);
      
      // Get user's projects and warm their metadata
      const projects = await this.getUserProjects(userId);
      
      // Warm statistics for each project
      await Promise.all(
        projects.map(project => 
          this.getBugStatistics(project.id, userId)
        )
      );
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  // Add/remove watcher with cache invalidation
  @InvalidatesCache((bugId: string) => [
    `bug:${bugId}:*`,
    `bugs:*`
  ])
  static async addWatcher(bugId: string, userId: string, watcherUserId: string): Promise<void> {
    await super.addWatcher(bugId, userId, watcherUserId);
  }

  @InvalidatesCache((bugId: string) => [
    `bug:${bugId}:*`,
    `bugs:*`
  ])
  static async removeWatcher(bugId: string, userId: string, watcherUserId: string): Promise<void> {
    await super.removeWatcher(bugId, userId, watcherUserId);
  }
}