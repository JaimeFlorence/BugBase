import { PrismaClient, BugStatus } from '@prisma/client';
import { BugService } from '../bug.service';
import { AppError } from '../../middleware/errorHandler';

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

describe('BugService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBug', () => {
    const mockProject = {
      id: 'project-1',
      key: 'TEST',
      members: [
        { userId: 'user-1', user: { id: 'user-1', role: 'DEVELOPER' } }
      ]
    };

    const mockBugData = {
      projectId: 'project-1',
      title: 'Test Bug',
      description: 'Test Description',
      priority: 'HIGH' as const,
      severity: 'MAJOR' as const,
    };

    it('should successfully create a bug', async () => {
      const mockBug = {
        id: 'bug-1',
        bugNumber: 1,
        title: 'Test Bug',
        projectId: 'project-1',
        reporterId: 'user-1',
      };

      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (mockPrisma.bug.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.bug.create as jest.Mock).mockResolvedValue(mockBug);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.create as jest.Mock).mockResolvedValue({});

      const result = await BugService.createBug(mockBugData, 'user-1');

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        include: {
          members: {
            where: { userId: 'user-1' },
            include: { user: true }
          }
        }
      });
      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...mockBugData,
          bugNumber: 1,
          reporterId: 'user-1',
          customFields: {}
        }),
        include: expect.any(Object)
      });
      expect(result).toEqual(mockBug);
    });

    it('should throw error if project not found', async () => {
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        BugService.createBug(mockBugData, 'user-1')
      ).rejects.toThrow(new AppError('Project not found', 404));
    });

    it('should throw error if user not a project member', async () => {
      const projectWithoutUser = {
        ...mockProject,
        members: []
      };

      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(projectWithoutUser);

      await expect(
        BugService.createBug(mockBugData, 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to create bugs in this project', 403));
    });

    it('should throw error if assignee not a project member', async () => {
      const bugDataWithAssignee = {
        ...mockBugData,
        assigneeId: 'user-2'
      };

      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (mockPrisma.projectMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        BugService.createBug(bugDataWithAssignee, 'user-1')
      ).rejects.toThrow(new AppError('Assignee must be a member of the project', 400));
    });

    it('should increment bug number correctly', async () => {
      const lastBug = { bugNumber: 5 };

      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (mockPrisma.bug.findFirst as jest.Mock).mockResolvedValue(lastBug);
      (mockPrisma.bug.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.create as jest.Mock).mockResolvedValue({});

      await BugService.createBug(mockBugData, 'user-1');

      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bugNumber: 6
        }),
        include: expect.any(Object)
      });
    });
  });

  describe('getBugById', () => {
    const mockBug = {
      id: 'bug-1',
      title: 'Test Bug',
      project: {
        members: [{ userId: 'user-1' }]
      }
    };

    it('should successfully get bug by id', async () => {
      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockBug);

      const result = await BugService.getBugById('bug-1', 'user-1');

      expect(mockPrisma.bug.findUnique).toHaveBeenCalledWith({
        where: { id: 'bug-1' },
        include: expect.any(Object)
      });
      expect(result).toEqual(mockBug);
    });

    it('should return null if bug not found', async () => {
      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await BugService.getBugById('bug-1', 'user-1');

      expect(result).toBeNull();
    });

    it('should throw error if user has no permission', async () => {
      const bugWithoutPermission = {
        ...mockBug,
        project: {
          members: []
        }
      };

      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(bugWithoutPermission);

      await expect(
        BugService.getBugById('bug-1', 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to view this bug', 403));
    });
  });

  describe('getBugs', () => {
    const mockFilters = {
      projectId: 'project-1',
      status: 'OPEN' as BugStatus
    };
    
    const mockPagination = {
      page: 1,
      limit: 10
    };

    const mockBugs = [
      { id: 'bug-1', title: 'Bug 1' },
      { id: 'bug-2', title: 'Bug 2' }
    ];

    it('should successfully get bugs with filters', async () => {
      (mockPrisma.projectMember.findFirst as jest.Mock).mockResolvedValue({ projectId: 'project-1' });
      (mockPrisma.bug.findMany as jest.Mock).mockResolvedValue(mockBugs);
      (mockPrisma.bug.count as jest.Mock).mockResolvedValue(2);

      const result = await BugService.getBugs(mockFilters, mockPagination, 'user-1');

      expect(mockPrisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          userId: 'user-1'
        }
      });
      expect(result.bugs).toEqual(mockBugs);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        totalCount: 2,
        totalPages: 1
      });
    });

    it('should throw error if user has no access to project', async () => {
      (mockPrisma.projectMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        BugService.getBugs(mockFilters, mockPagination, 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to view bugs in this project', 403));
    });

    it('should handle search filter', async () => {
      const filtersWithSearch = {
        search: 'test search'
      };

      (mockPrisma.projectMember.findMany as jest.Mock).mockResolvedValue([{ projectId: 'project-1' }]);
      (mockPrisma.bug.findMany as jest.Mock).mockResolvedValue(mockBugs);
      (mockPrisma.bug.count as jest.Mock).mockResolvedValue(2);

      await BugService.getBugs(filtersWithSearch, mockPagination, 'user-1');

      expect(mockPrisma.bug.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'test search', mode: 'insensitive' } },
            { description: { contains: 'test search', mode: 'insensitive' } }
          ]
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10
      });
    });
  });

  describe('updateBug', () => {
    const mockCurrentBug = {
      id: 'bug-1',
      projectId: 'project-1',
      status: 'OPEN',
      priority: 'MEDIUM',
      assigneeId: null,
      reporterId: 'user-1',
      project: {
        key: 'TEST',
        members: [
          { userId: 'user-1', user: { id: 'user-1', role: 'DEVELOPER' } }
        ]
      }
    };

    const updateData = {
      status: 'RESOLVED' as const,
      priority: 'HIGH' as const
    };

    it('should successfully update bug', async () => {
      const updatedBug = { ...mockCurrentBug, ...updateData };

      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockCurrentBug);
      (mockPrisma.bug.update as jest.Mock).mockResolvedValue(updatedBug);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const result = await BugService.updateBug('bug-1', updateData, 'user-1');

      expect(mockPrisma.bug.update).toHaveBeenCalledWith({
        where: { id: 'bug-1' },
        data: expect.objectContaining({
          ...updateData,
          resolvedAt: expect.any(Date)
        }),
        include: expect.any(Object)
      });
      expect(result).toEqual(updatedBug);
    });

    it('should throw error if bug not found', async () => {
      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        BugService.updateBug('bug-1', updateData, 'user-1')
      ).rejects.toThrow(new AppError('Bug not found', 404));
    });

    it('should throw error if user has no permission', async () => {
      const bugWithoutPermission = {
        ...mockCurrentBug,
        project: {
          ...mockCurrentBug.project,
          members: []
        }
      };

      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(bugWithoutPermission);

      await expect(
        BugService.updateBug('bug-1', updateData, 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to update this bug', 403));
    });

    it('should set resolvedAt when status changes to RESOLVED', async () => {
      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockCurrentBug);
      (mockPrisma.bug.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await BugService.updateBug('bug-1', { status: 'RESOLVED' }, 'user-1');

      expect(mockPrisma.bug.update).toHaveBeenCalledWith({
        where: { id: 'bug-1' },
        data: expect.objectContaining({
          resolvedAt: expect.any(Date)
        }),
        include: expect.any(Object)
      });
    });

    it('should create activity log for changes', async () => {
      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockCurrentBug);
      (mockPrisma.bug.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await BugService.updateBug('bug-1', updateData, 'user-1');

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          bugId: 'bug-1',
          userId: 'user-1',
          action: 'UPDATED',
          metadata: {
            description: expect.stringContaining('Status changed from OPEN to RESOLVED')
          }
        }
      });
    });
  });

  describe('deleteBug', () => {
    const mockCurrentBug = {
      id: 'bug-1',
      bugNumber: 1,
      reporterId: 'user-1',
      project: {
        key: 'TEST',
        members: [
          { userId: 'user-1', user: { id: 'user-1', role: 'ADMIN' } }
        ]
      }
    };

    it('should successfully delete bug as admin', async () => {
      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockCurrentBug);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bug.delete as jest.Mock).mockResolvedValue({});

      await BugService.deleteBug('bug-1', 'user-1');

      expect(mockPrisma.activityLog.create).toHaveBeenCalled();
      expect(mockPrisma.bug.delete).toHaveBeenCalledWith({
        where: { id: 'bug-1' }
      });
    });

    it('should throw error if bug not found', async () => {
      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        BugService.deleteBug('bug-1', 'user-1')
      ).rejects.toThrow(new AppError('Bug not found', 404));
    });

    it('should throw error if user has no permission to delete', async () => {
      const bugWithoutDeletePermission = {
        ...mockCurrentBug,
        reporterId: 'user-2',
        project: {
          ...mockCurrentBug.project,
          members: [
            { userId: 'user-1', user: { id: 'user-1', role: 'REPORTER' } }
          ]
        }
      };

      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(bugWithoutDeletePermission);

      await expect(
        BugService.deleteBug('bug-1', 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to delete this bug', 403));
    });
  });

  describe('addWatcher', () => {
    it('should successfully add watcher', async () => {
      const mockBug = {
        id: 'bug-1',
        project: {
          members: [{ userId: 'user-1' }]
        }
      };

      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockBug);
      (mockPrisma.bugWatcher.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.bugWatcher.create as jest.Mock).mockResolvedValue({});

      await BugService.addWatcher('bug-1', 'user-1', 'user-2');

      expect(mockPrisma.bugWatcher.create).toHaveBeenCalledWith({
        data: {
          bugId: 'bug-1',
          userId: 'user-2'
        }
      });
    });

    it('should throw error if watcher already exists', async () => {
      const mockBug = {
        id: 'bug-1',
        project: {
          members: [{ userId: 'user-1' }]
        }
      };

      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockBug);
      (mockPrisma.bugWatcher.findUnique as jest.Mock).mockResolvedValue({ id: 'watcher-1' });

      await expect(
        BugService.addWatcher('bug-1', 'user-1', 'user-2')
      ).rejects.toThrow(new AppError('User is already watching this bug', 400));
    });
  });

  describe('removeWatcher', () => {
    it('should successfully remove watcher', async () => {
      const mockBug = {
        id: 'bug-1',
        project: {
          members: [{ userId: 'user-1' }]
        }
      };

      (mockPrisma.bug.findUnique as jest.Mock).mockResolvedValue(mockBug);
      (mockPrisma.bugWatcher.delete as jest.Mock).mockResolvedValue({});

      await BugService.removeWatcher('bug-1', 'user-1', 'user-2');

      expect(mockPrisma.bugWatcher.delete).toHaveBeenCalledWith({
        where: {
          bugId_userId: {
            bugId: 'bug-1',
            userId: 'user-2'
          }
        }
      });
    });
  });
});