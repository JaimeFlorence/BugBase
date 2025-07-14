import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock the api before importing the bug service
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../api';
import bugService from '../bug.service';
import type { Bug, BugFilters, PaginationParams } from '../../types';

const mockApi = api as any;

describe('BugService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBug: Bug = {
    id: '1',
    bugNumber: 1,
    title: 'Test Bug',
    description: 'Test Description',
    status: 'NEW',
    priority: 'HIGH',
    severity: 'MAJOR',
    reporterId: 'user-1',
    assigneeId: 'user-2',
    projectId: 'project-1',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    project: { key: 'TEST' },
  };

  describe('createBug', () => {
    it('should create a bug successfully', async () => {
      const createData = {
        title: 'New Bug',
        description: 'Bug description',
        projectId: 'project-1',
        priority: 'HIGH' as const,
        severity: 'MAJOR' as const,
      };

      const mockResponse = {
        data: {
          success: true,
          data: { bug: mockBug }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await bugService.createBug(createData);

      expect(mockApi.post).toHaveBeenCalledWith('/bugs', createData);
      expect(result).toEqual(mockBug);
    });

    it('should handle creation errors', async () => {
      const createData = {
        title: 'New Bug',
        description: 'Bug description',
        projectId: 'project-1',
        priority: 'HIGH' as const,
        severity: 'MAJOR' as const,
      };

      mockApi.post.mockRejectedValue(new Error('Creation failed'));

      await expect(bugService.createBug(createData))
        .rejects.toThrow('Creation failed');
    });
  });

  describe('getBugs', () => {
    it('should get bugs with filters and pagination', async () => {
      const filters: BugFilters = {
        status: 'NEW',
        priority: 'HIGH',
        projectId: 'project-1'
      };

      const pagination: PaginationParams = {
        page: 1,
        limit: 20
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            bugs: [mockBug],
            pagination: {
              page: 1,
              limit: 20,
              totalCount: 1,
              totalPages: 1
            }
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await bugService.getBugs(filters, pagination);

      expect(mockApi.get).toHaveBeenCalledWith('/bugs', {
        params: {
          status: 'NEW',
          priority: 'HIGH',
          projectId: 'project-1',
          page: 1,
          limit: 20
        }
      });
      expect(result.data).toEqual([mockBug]);
      expect(result.pagination.totalCount).toBe(1);
    });

    it('should get bugs without filters or pagination', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            bugs: [mockBug],
            pagination: {
              page: 1,
              limit: 20,
              totalCount: 1,
              totalPages: 1
            }
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await bugService.getBugs();

      expect(mockApi.get).toHaveBeenCalledWith('/bugs', { params: {} });
      expect(result.data).toEqual([mockBug]);
    });
  });

  describe('getBugById', () => {
    it('should get a single bug by ID', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { bug: mockBug }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await bugService.getBugById('1');

      expect(mockApi.get).toHaveBeenCalledWith('/bugs/1');
      expect(result).toEqual(mockBug);
    });

    it('should handle get bug errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Bug not found'));

      await expect(bugService.getBugById('999'))
        .rejects.toThrow('Bug not found');
    });
  });

  describe('updateBug', () => {
    it('should update a bug successfully', async () => {
      const updateData = {
        title: 'Updated Bug',
        status: 'RESOLVED' as const
      };

      const updatedBug = { ...mockBug, ...updateData };
      const mockResponse = {
        data: {
          success: true,
          data: { bug: updatedBug }
        }
      };

      mockApi.put.mockResolvedValue(mockResponse);

      const result = await bugService.updateBug('1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/bugs/1', updateData);
      expect(result).toEqual(updatedBug);
    });

    it('should handle update errors', async () => {
      const updateData = { title: 'Updated Bug' };
      mockApi.put.mockRejectedValue(new Error('Update failed'));

      await expect(bugService.updateBug('1', updateData))
        .rejects.toThrow('Update failed');
    });
  });

  describe('deleteBug', () => {
    it('should delete a bug successfully', async () => {
      mockApi.delete.mockResolvedValue({});

      await bugService.deleteBug('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/bugs/1');
    });

    it('should handle delete errors', async () => {
      mockApi.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(bugService.deleteBug('1'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('getBugStatistics', () => {
    it('should get bug statistics without project filter', async () => {
      const mockStats = {
        total: 10,
        open: 6,
        closed: 4,
        byStatus: {
          NEW: 3,
          IN_PROGRESS: 2,
          RESOLVED: 4,
          CLOSED: 1
        }
      };

      const mockResponse = {
        data: {
          success: true,
          data: { statistics: mockStats }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await bugService.getBugStatistics();

      expect(mockApi.get).toHaveBeenCalledWith('/bugs/statistics', { params: {} });
      expect(result).toEqual(mockStats);
    });

    it('should get bug statistics with project filter', async () => {
      const mockStats = {
        total: 5,
        open: 3,
        closed: 2,
        byStatus: {
          NEW: 2,
          IN_PROGRESS: 1,
          RESOLVED: 2,
          CLOSED: 0
        }
      };

      const mockResponse = {
        data: {
          success: true,
          data: { statistics: mockStats }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await bugService.getBugStatistics('project-1');

      expect(mockApi.get).toHaveBeenCalledWith('/bugs/statistics', {
        params: { projectId: 'project-1' }
      });
      expect(result).toEqual(mockStats);
    });
  });

  describe('addWatcher', () => {
    it('should add a watcher successfully', async () => {
      mockApi.post.mockResolvedValue({});

      await bugService.addWatcher('bug-1', 'user-1');

      expect(mockApi.post).toHaveBeenCalledWith('/bugs/bug-1/watchers', {
        userId: 'user-1'
      });
    });

    it('should handle add watcher errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Failed to add watcher'));

      await expect(bugService.addWatcher('bug-1', 'user-1'))
        .rejects.toThrow('Failed to add watcher');
    });
  });

  describe('removeWatcher', () => {
    it('should remove a watcher successfully', async () => {
      mockApi.delete.mockResolvedValue({});

      await bugService.removeWatcher('bug-1', 'user-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/bugs/bug-1/watchers', {
        data: { userId: 'user-1' }
      });
    });

    it('should handle remove watcher errors', async () => {
      mockApi.delete.mockRejectedValue(new Error('Failed to remove watcher'));

      await expect(bugService.removeWatcher('bug-1', 'user-1'))
        .rejects.toThrow('Failed to remove watcher');
    });
  });

  describe('Helper Methods', () => {
    describe('isOpen', () => {
      it('should return true for open bug statuses', () => {
        const openStatuses = ['NEW', 'IN_PROGRESS', 'TESTING', 'REOPENED'];
        
        openStatuses.forEach(status => {
          const bug = { ...mockBug, status };
          expect(bugService.isOpen(bug)).toBe(true);
        });
      });

      it('should return false for closed bug statuses', () => {
        const closedStatuses = ['RESOLVED', 'CLOSED'];
        
        closedStatuses.forEach(status => {
          const bug = { ...mockBug, status };
          expect(bugService.isOpen(bug)).toBe(false);
        });
      });
    });

    describe('isClosed', () => {
      it('should return true for closed bug statuses', () => {
        const closedStatuses = ['RESOLVED', 'CLOSED'];
        
        closedStatuses.forEach(status => {
          const bug = { ...mockBug, status };
          expect(bugService.isClosed(bug)).toBe(true);
        });
      });

      it('should return false for open bug statuses', () => {
        const openStatuses = ['NEW', 'IN_PROGRESS', 'TESTING', 'REOPENED'];
        
        openStatuses.forEach(status => {
          const bug = { ...mockBug, status };
          expect(bugService.isClosed(bug)).toBe(false);
        });
      });
    });

    describe('formatBugReference', () => {
      it('should format bug reference with project key', () => {
        const bug = { ...mockBug, project: { key: 'TEST' }, bugNumber: 123 };
        expect(bugService.formatBugReference(bug)).toBe('TEST-123');
      });

      it('should format bug reference without project key', () => {
        const bug = { ...mockBug, project: undefined, bugNumber: 123 };
        expect(bugService.formatBugReference(bug)).toBe('BUG-123');
      });

      it('should format bug reference with empty project key', () => {
        const bug = { ...mockBug, project: { key: '' }, bugNumber: 123 };
        expect(bugService.formatBugReference(bug)).toBe('BUG-123');
      });
    });

    describe('getStatusColor', () => {
      it('should return correct colors for known statuses', () => {
        expect(bugService.getStatusColor('NEW')).toBe('blue');
        expect(bugService.getStatusColor('IN_PROGRESS')).toBe('yellow');
        expect(bugService.getStatusColor('TESTING')).toBe('purple');
        expect(bugService.getStatusColor('RESOLVED')).toBe('green');
        expect(bugService.getStatusColor('CLOSED')).toBe('gray');
        expect(bugService.getStatusColor('REOPENED')).toBe('orange');
      });

      it('should return gray for unknown status', () => {
        expect(bugService.getStatusColor('UNKNOWN')).toBe('gray');
      });
    });

    describe('getPriorityColor', () => {
      it('should return correct colors for known priorities', () => {
        expect(bugService.getPriorityColor('CRITICAL')).toBe('red');
        expect(bugService.getPriorityColor('HIGH')).toBe('orange');
        expect(bugService.getPriorityColor('MEDIUM')).toBe('yellow');
        expect(bugService.getPriorityColor('LOW')).toBe('green');
      });

      it('should return gray for unknown priority', () => {
        expect(bugService.getPriorityColor('UNKNOWN')).toBe('gray');
      });
    });

    describe('getSeverityColor', () => {
      it('should return correct colors for known severities', () => {
        expect(bugService.getSeverityColor('BLOCKER')).toBe('red');
        expect(bugService.getSeverityColor('MAJOR')).toBe('orange');
        expect(bugService.getSeverityColor('MINOR')).toBe('yellow');
        expect(bugService.getSeverityColor('TRIVIAL')).toBe('green');
      });

      it('should return gray for unknown severity', () => {
        expect(bugService.getSeverityColor('UNKNOWN')).toBe('gray');
      });
    });
  });
});