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

export class BugService {
  static async createBug(data: CreateBugData, reporterId: string): Promise<Bug> {
    // Verify project exists and user has permission
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      include: {
        members: {
          where: { userId: reporterId },
          include: { user: true }
        }
      }
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const userMember = project.members.find((m: any) => m.userId === reporterId);
    if (!userMember) {
      throw new AppError('You do not have permission to create bugs in this project', 403);
    }

    // Validate assignee if provided
    if (data.assigneeId) {
      const assignee = await prisma.projectMember.findFirst({
        where: {
          projectId: data.projectId,
          userId: data.assigneeId
        }
      });

      if (!assignee) {
        throw new AppError('Assignee must be a member of the project', 400);
      }
    }

    // Get next bug number for the project
    const lastBug = await prisma.bug.findFirst({
      where: { projectId: data.projectId },
      orderBy: { bugNumber: 'desc' }
    });

    const bugNumber = (lastBug?.bugNumber || 0) + 1;

    // Create the bug
    const bug = await prisma.bug.create({
      data: {
        ...data,
        bugNumber,
        reporterId,
        customFields: data.customFields || {}
      },
      include: {
        project: true,
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
          include: {
            label: true
          }
        },
        milestone: true,
        _count: {
          select: {
            comments: true,
            attachments: true,
            watchers: true
          }
        }
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        bugId: bug.id,
        userId: reporterId,
        action: 'CREATED',
        metadata: { description: `Bug ${project.key}-${bugNumber} created` }
      }
    });

    // Add reporter as watcher
    await prisma.bugWatcher.create({
      data: {
        bugId: bug.id,
        userId: reporterId
      }
    });

    return bug;
  }

  static async getBugById(id: string, userId: string): Promise<Bug | null> {
    const bug = await prisma.bug.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: {
              where: { userId }
            }
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
          include: {
            label: true
          }
        },
        milestone: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true
              }
            },
            attachments: true,
            _count: {
              select: {
                replies: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        watchers: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            watchers: true
          }
        }
      }
    });

    if (!bug) {
      return null;
    }

    // Check if user has permission to view this bug
    const hasPermission = bug.project.members.length > 0;
    if (!hasPermission) {
      throw new AppError('You do not have permission to view this bug', 403);
    }

    return bug;
  }

  static async getBugs(
    filters: BugFilters,
    pagination: PaginationOptions,
    userId: string
  ) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    if (filters.projectId) {
      // Verify user has access to project
      const projectMember = await prisma.projectMember.findFirst({
        where: {
          projectId: filters.projectId,
          userId
        }
      });

      if (!projectMember) {
        throw new AppError('You do not have permission to view bugs in this project', 403);
      }

      whereClause.projectId = filters.projectId;
    } else {
      // Get all projects user has access to
      const userProjects = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true }
      });

      whereClause.projectId = {
        in: userProjects.map((p: any) => p.projectId)
      };
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

    // Get bugs
    const bugs = await prisma.bug.findMany({
      where: whereClause,
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
        },
        labels: {
          include: {
            label: true
          }
        },
        milestone: {
          select: {
            id: true,
            name: true,
            dueDate: true
          }
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            watchers: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: offset,
      take: limit
    });

    // Get total count
    const totalCount = await prisma.bug.count({
      where: whereClause
    });

    return {
      bugs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  static async updateBug(id: string, data: UpdateBugData, userId: string): Promise<Bug> {
    // Get current bug and check permissions
    const currentBug = await prisma.bug.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
              include: { user: true }
            }
          }
        }
      }
    });

    if (!currentBug) {
      throw new AppError('Bug not found', 404);
    }

    const userMember = currentBug.project.members.find((m: any) => m.userId === userId);
    if (!userMember) {
      throw new AppError('You do not have permission to update this bug', 403);
    }

    // Validate assignee if provided
    if (data.assigneeId) {
      const assignee = await prisma.projectMember.findFirst({
        where: {
          projectId: currentBug.projectId,
          userId: data.assigneeId
        }
      });

      if (!assignee) {
        throw new AppError('Assignee must be a member of the project', 400);
      }
    }

    // Set resolvedAt if status is being changed to RESOLVED
    const updateData: any = { ...data };
    if (data.status === 'RESOLVED' && currentBug.status !== 'RESOLVED') {
      updateData.resolvedAt = new Date();
    } else if (data.status && data.status !== 'RESOLVED') {
      updateData.resolvedAt = null;
    }

    // Update the bug
    const updatedBug = await prisma.bug.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
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
          include: {
            label: true
          }
        },
        milestone: true,
        _count: {
          select: {
            comments: true,
            attachments: true,
            watchers: true
          }
        }
      }
    });

    // Create activity log
    const changes = [];
    if (data.status && data.status !== currentBug.status) {
      changes.push(`Status changed from ${currentBug.status} to ${data.status}`);
    }
    if (data.priority && data.priority !== currentBug.priority) {
      changes.push(`Priority changed from ${currentBug.priority} to ${data.priority}`);
    }
    if (data.assigneeId !== undefined && data.assigneeId !== currentBug.assigneeId) {
      changes.push(`Assignee changed`);
    }

    if (changes.length > 0) {
      await prisma.activityLog.create({
        data: {
          bugId: id,
          userId,
          action: 'UPDATED',
          metadata: { description: changes.join(', ') }
        }
      });
    }

    return updatedBug;
  }

  static async deleteBug(id: string, userId: string): Promise<void> {
    // Get current bug and check permissions
    const currentBug = await prisma.bug.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
              include: { user: true }
            }
          }
        }
      }
    });

    if (!currentBug) {
      throw new AppError('Bug not found', 404);
    }

    const userMember = currentBug.project.members.find((m: any) => m.userId === userId);
    if (!userMember) {
      throw new AppError('You do not have permission to delete this bug', 403);
    }

    // Only allow deletion by project managers, admins, or bug reporter
    const canDelete = userMember.user.role === 'ADMIN' || 
                     userMember.user.role === 'PROJECT_MANAGER' || 
                     currentBug.reporterId === userId;

    if (!canDelete) {
      throw new AppError('You do not have permission to delete this bug', 403);
    }

    // Create activity log before deleting the bug
    await prisma.activityLog.create({
      data: {
        bugId: currentBug.id,
        userId,
        action: 'DELETED',
        metadata: { description: `Bug ${currentBug.project.key}-${currentBug.bugNumber} deleted` }
      }
    });

    // Delete the bug (cascade will handle related records)
    await prisma.bug.delete({
      where: { id }
    });
  }

  static async addWatcher(bugId: string, userId: string, watcherId: string): Promise<void> {
    // Verify bug exists and user has permission
    const bug = await this.getBugById(bugId, userId);
    if (!bug) {
      throw new AppError('Bug not found', 404);
    }

    // Check if watcher is already watching
    const existingWatcher = await prisma.bugWatcher.findUnique({
      where: {
        bugId_userId: {
          bugId,
          userId: watcherId
        }
      }
    });

    if (existingWatcher) {
      throw new AppError('User is already watching this bug', 400);
    }

    // Add watcher
    await prisma.bugWatcher.create({
      data: {
        bugId,
        userId: watcherId
      }
    });
  }

  static async removeWatcher(bugId: string, userId: string, watcherId: string): Promise<void> {
    // Verify bug exists and user has permission
    const bug = await this.getBugById(bugId, userId);
    if (!bug) {
      throw new AppError('Bug not found', 404);
    }

    // Remove watcher
    await prisma.bugWatcher.delete({
      where: {
        bugId_userId: {
          bugId,
          userId: watcherId
        }
      }
    });
  }
}