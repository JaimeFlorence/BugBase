import { PrismaClient } from '@prisma/client';
import { Bug, BugStatus, BugPriority, BugSeverity } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

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

export class BugServiceOptimized {
  // Optimized createBug with transaction
  static async createBug(data: CreateBugData, reporterId: string): Promise<Bug> {
    return await prisma.$transaction(async (tx) => {
      // Combined query to verify project exists and user has permission
      const project = await tx.project.findFirst({
        where: {
          id: data.projectId,
          members: {
            some: {
              userId: reporterId
            }
          }
        }
      });

      if (!project) {
        throw new AppError('Project not found or you do not have permission', 404);
      }

      // Validate assignee if provided (single query)
      if (data.assigneeId) {
        const assigneeExists = await tx.projectMember.count({
          where: {
            projectId: data.projectId,
            userId: data.assigneeId
          }
        });

        if (!assigneeExists) {
          throw new AppError('Assignee must be a member of the project', 400);
        }
      }

      // Get next bug number using aggregation
      const lastBugNumber = await tx.bug.aggregate({
        where: { projectId: data.projectId },
        _max: { bugNumber: true }
      });

      const bugNumber = (lastBugNumber._max.bugNumber || 0) + 1;

      // Create bug and watcher in a single transaction
      const bug = await tx.bug.create({
        data: {
          projectId: data.projectId,
          bugNumber,
          title: data.title,
          description: data.description,
          priority: data.priority || BugPriority.MEDIUM,
          severity: data.severity || BugSeverity.MINOR,
          reporterId,
          assigneeId: data.assigneeId,
          dueDate: data.dueDate,
          estimatedHours: data.estimatedHours,
          versionFound: data.versionFound,
          environment: data.environment,
          customFields: data.customFields || {},
          // Create watcher in the same operation
          watchers: {
            create: {
              userId: reporterId
            }
          },
          // Create activity log
          activities: {
            create: {
              userId: reporterId,
              action: 'CREATED'
            }
          }
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              key: true
            }
          },
          reporter: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true
            }
          },
          assignee: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true
            }
          }
        }
      });

      return bug;
    });
  }

  // Optimized getBugById with selective loading and pagination for comments
  static async getBugById(id: string, userId: string, includeComments = true): Promise<Bug | null> {
    const bug = await prisma.bug.findFirst({
      where: {
        id,
        // Include permission check in the query
        project: {
          members: {
            some: {
              userId
            }
          }
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            color: true,
            icon: true
          }
        },
        reporter: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        assignee: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        labels: {
          select: {
            label: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        },
        milestone: {
          select: {
            id: true,
            name: true,
            dueDate: true,
            isCompleted: true
          }
        },
        // Conditional comment loading with pagination
        comments: includeComments ? {
          where: {
            parentId: null // Only top-level comments
          },
          select: {
            id: true,
            content: true,
            isEdited: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true
              }
            },
            attachments: {
              select: {
                id: true,
                filename: true,
                fileSize: true,
                mimeType: true
              }
            },
            _count: {
              select: {
                replies: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Initial load limit
        } : false,
        attachments: {
          select: {
            id: true,
            filename: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: {
              select: {
                id: true,
                username: true
              }
            }
          }
        },
        // Use count instead of loading all watchers
        _count: {
          select: {
            comments: true,
            attachments: true,
            watchers: true,
            activities: true
          }
        }
      }
    });

    return bug;
  }

  // Optimized getBugs with combined permission check and selective fields
  static async getBugs(
    filters: BugFilters,
    pagination: PaginationOptions,
    userId: string
  ) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    // Build where clause with integrated permission check
    const whereClause: any = {
      project: {
        members: {
          some: {
            userId
          }
        }
      }
    };

    // Add specific project filter if provided
    if (filters.projectId) {
      whereClause.projectId = filters.projectId;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.priority) {
      whereClause.priority = filters.priority;
    }

    if (filters.severity) {
      whereClause.severity = filters.severity;
    }

    if (filters.assigneeId) {
      whereClause.assigneeId = filters.assigneeId;
    }

    if (filters.reporterId) {
      whereClause.reporterId = filters.reporterId;
    }

    if (filters.milestoneId) {
      whereClause.milestoneId = filters.milestoneId;
    }

    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.labels && filters.labels.length > 0) {
      whereClause.labels = {
        some: {
          label: {
            name: { in: filters.labels }
          }
        }
      };
    }

    // Execute count and data queries in parallel
    const [bugs, totalCount] = await Promise.all([
      prisma.bug.findMany({
        where: whereClause,
        select: {
          id: true,
          bugNumber: true,
          title: true,
          status: true,
          priority: true,
          severity: true,
          createdAt: true,
          updatedAt: true,
          dueDate: true,
          project: {
            select: {
              id: true,
              name: true,
              key: true,
              color: true
            }
          },
          reporter: {
            select: {
              id: true,
              username: true,
              avatarUrl: true
            }
          },
          assignee: {
            select: {
              id: true,
              username: true,
              avatarUrl: true
            }
          },
          milestone: {
            select: {
              id: true,
              name: true
            }
          },
          // Use count aggregations instead of loading relations
          _count: {
            select: {
              comments: true,
              attachments: true,
              watchers: true,
              labels: true
            }
          }
        },
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.bug.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      bugs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    };
  }

  // Optimized updateBug with transaction
  static async updateBug(id: string, data: UpdateBugData, userId: string): Promise<Bug> {
    return await prisma.$transaction(async (tx) => {
      // Check bug exists and user has permission in one query
      const existingBug = await tx.bug.findFirst({
        where: {
          id,
          project: {
            members: {
              some: {
                userId
              }
            }
          }
        },
        select: {
          id: true,
          status: true,
          assigneeId: true,
          projectId: true
        }
      });

      if (!existingBug) {
        throw new AppError('Bug not found or you do not have permission', 404);
      }

      // Validate new assignee if changed
      if (data.assigneeId && data.assigneeId !== existingBug.assigneeId) {
        const assigneeExists = await tx.projectMember.count({
          where: {
            projectId: existingBug.projectId,
            userId: data.assigneeId
          }
        });

        if (!assigneeExists) {
          throw new AppError('Assignee must be a member of the project', 400);
        }
      }

      // Prepare activity log data
      const activityData: any = {
        userId,
        action: 'UPDATED',
        oldValue: {},
        newValue: {}
      };

      // Track changes for activity log
      if (data.status && data.status !== existingBug.status) {
        activityData.action = 'STATUS_CHANGED';
        activityData.oldValue.status = existingBug.status;
        activityData.newValue.status = data.status;
      }

      if (data.assigneeId && data.assigneeId !== existingBug.assigneeId) {
        activityData.action = 'ASSIGNED';
        activityData.oldValue.assigneeId = existingBug.assigneeId;
        activityData.newValue.assigneeId = data.assigneeId;
      }

      // Update bug with activity log in one operation
      const updatedBug = await tx.bug.update({
        where: { id },
        data: {
          ...data,
          resolvedAt: data.status === BugStatus.RESOLVED ? new Date() : undefined,
          activities: {
            create: activityData
          }
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              key: true
            }
          },
          reporter: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true
            }
          },
          assignee: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true
            }
          }
        }
      });

      return updatedBug;
    });
  }

  // Optimized batch operations for watchers
  static async addWatcher(bugId: string, userId: string, watcherUserId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Verify bug exists and user has permission
      const bug = await tx.bug.findFirst({
        where: {
          id: bugId,
          project: {
            members: {
              some: {
                userId
              }
            }
          }
        },
        select: { id: true }
      });

      if (!bug) {
        throw new AppError('Bug not found or you do not have permission', 404);
      }

      // Upsert watcher to avoid duplicates
      await tx.bugWatcher.upsert({
        where: {
          bugId_userId: {
            bugId,
            userId: watcherUserId
          }
        },
        create: {
          bugId,
          userId: watcherUserId
        },
        update: {} // No-op if already exists
      });
    });
  }

  static async removeWatcher(bugId: string, userId: string, watcherUserId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Verify bug exists and user has permission
      const bug = await tx.bug.findFirst({
        where: {
          id: bugId,
          project: {
            members: {
              some: {
                userId
              }
            }
          }
        },
        select: { id: true }
      });

      if (!bug) {
        throw new AppError('Bug not found or you do not have permission', 404);
      }

      // Delete watcher
      await tx.bugWatcher.delete({
        where: {
          bugId_userId: {
            bugId,
            userId: watcherUserId
          }
        }
      }).catch(() => {
        // Ignore if watcher doesn't exist
      });
    });
  }

  static async deleteBug(id: string, userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Check bug exists and user has permission
      const bug = await tx.bug.findFirst({
        where: {
          id,
          project: {
            members: {
              some: {
                userId
              }
            }
          }
        },
        select: { id: true }
      });

      if (!bug) {
        throw new AppError('Bug not found or you do not have permission', 404);
      }

      // Delete bug (cascades will handle related data)
      await tx.bug.delete({
        where: { id }
      });
    });
  }

  // New method for loading comment replies with pagination
  static async getCommentReplies(commentId: string, userId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const replies = await prisma.comment.findMany({
      where: {
        parentId: commentId,
        bug: {
          project: {
            members: {
              some: {
                userId
              }
            }
          }
        }
      },
      select: {
        id: true,
        content: true,
        isEdited: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            fileSize: true,
            mimeType: true
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'asc' }
    });

    return replies;
  }
}