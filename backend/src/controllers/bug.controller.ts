import { Request, Response, NextFunction } from 'express';
import { BugService } from '../services/bug.service';
import { AppError } from '../middleware/errorHandler';
import { BugStatus, BugPriority, BugSeverity } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class BugController {
  static async createBug(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        projectId,
        title,
        description,
        priority,
        severity,
        assigneeId,
        dueDate,
        estimatedHours,
        versionFound,
        environment,
        customFields
      } = req.body;

      if (!projectId || !title || !description) {
        throw new AppError('Project ID, title, and description are required', 400);
      }

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const bugData = {
        projectId,
        title,
        description,
        priority: priority as BugPriority,
        severity: severity as BugSeverity,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        versionFound,
        environment,
        customFields
      };

      const bug = await BugService.createBug(bugData, req.user.id);

      res.status(201).json({
        success: true,
        data: { bug }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBugById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const bug = await BugService.getBugById(id, req.user.id);

      if (!bug) {
        throw new AppError('Bug not found', 404);
      }

      res.json({
        success: true,
        data: { bug }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBugs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const {
        projectId,
        status,
        priority,
        severity,
        assigneeId,
        reporterId,
        search,
        milestoneId,
        labels,
        page = '1',
        limit = '20',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters = {
        projectId: projectId as string,
        status: status as BugStatus,
        priority: priority as BugPriority,
        severity: severity as BugSeverity,
        assigneeId: assigneeId as string,
        reporterId: reporterId as string,
        search: search as string,
        milestoneId: milestoneId as string,
        labels: labels ? (Array.isArray(labels) ? labels as string[] : [labels as string]) : undefined
      };

      const pagination = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      // Validate pagination
      if (pagination.page < 1) {
        throw new AppError('Page must be greater than 0', 400);
      }

      if (pagination.limit < 1 || pagination.limit > 100) {
        throw new AppError('Limit must be between 1 and 100', 400);
      }

      const result = await BugService.getBugs(filters, pagination, req.user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBug(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        status,
        priority,
        severity,
        assigneeId,
        dueDate,
        estimatedHours,
        actualHours,
        versionFound,
        versionFixed,
        environment,
        customFields
      } = req.body;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const updateData = {
        title,
        description,
        status: status as BugStatus,
        priority: priority as BugPriority,
        severity: severity as BugSeverity,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        actualHours: actualHours ? parseFloat(actualHours) : undefined,
        versionFound,
        versionFixed,
        environment,
        customFields
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const bug = await BugService.updateBug(id, updateData, req.user.id);

      res.json({
        success: true,
        data: { bug }
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBug(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      await BugService.deleteBug(id, req.user.id);

      res.json({
        success: true,
        message: 'Bug deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async addWatcher(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      await BugService.addWatcher(id, req.user.id, userId);

      res.json({
        success: true,
        message: 'Watcher added successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeWatcher(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      await BugService.removeWatcher(id, req.user.id, userId);

      res.json({
        success: true,
        message: 'Watcher removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBugStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.query;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const filters = {
        projectId: projectId as string
      };

      // Get bugs with different statuses
      const [
        allBugs,
        newBugs,
        inProgressBugs,
        resolvedBugs,
        closedBugs
      ] = await Promise.all([
        BugService.getBugs(filters, { page: 1, limit: 1 }, req.user.id),
        BugService.getBugs({ ...filters, status: BugStatus.NEW }, { page: 1, limit: 1 }, req.user.id),
        BugService.getBugs({ ...filters, status: BugStatus.IN_PROGRESS }, { page: 1, limit: 1 }, req.user.id),
        BugService.getBugs({ ...filters, status: BugStatus.RESOLVED }, { page: 1, limit: 1 }, req.user.id),
        BugService.getBugs({ ...filters, status: BugStatus.CLOSED }, { page: 1, limit: 1 }, req.user.id)
      ]);

      const statistics = {
        total: allBugs.pagination.totalCount,
        new: newBugs.pagination.totalCount,
        inProgress: inProgressBugs.pagination.totalCount,
        resolved: resolvedBugs.pagination.totalCount,
        closed: closedBugs.pagination.totalCount,
        open: allBugs.pagination.totalCount - resolvedBugs.pagination.totalCount - closedBugs.pagination.totalCount
      };

      res.json({
        success: true,
        data: { statistics }
      });
    } catch (error) {
      next(error);
    }
  }
}