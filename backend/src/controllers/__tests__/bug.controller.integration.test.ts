import request from 'supertest';
import express from 'express';
import bugRoutes from '../../routes/bug.routes';
import { errorHandler } from '../../middleware/errorHandler';

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  })
}));

// Mock the bug service
jest.mock('../../services/bug.service', () => ({
  BugService: {
    createBug: jest.fn(),
    getBugById: jest.fn(),
    getBugs: jest.fn(),
    updateBug: jest.fn(),
    deleteBug: jest.fn(),
    addWatcher: jest.fn(),
    removeWatcher: jest.fn(),
  }
}));

import { BugService } from '../../services/bug.service';

describe('Bug Controller Integration Tests', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/bugs', bugRoutes);
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  describe('GET /api/bugs', () => {
    it('should get bugs successfully', async () => {
      const mockBugs = {
        bugs: [
          { id: '1', title: 'Test Bug 1', status: 'NEW' },
          { id: '2', title: 'Test Bug 2', status: 'IN_PROGRESS' }
        ],
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 2,
          totalPages: 1
        }
      };

      (BugService.getBugs as jest.Mock).mockResolvedValue(mockBugs);

      const response = await request(app)
        .get('/api/bugs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBugs);
      expect(BugService.getBugs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        'test-user-id'
      );
    });

    it('should handle query parameters', async () => {
      const mockBugs = {
        bugs: [],
        pagination: {
          page: 1,
          limit: 10,
          totalCount: 0,
          totalPages: 0
        }
      };

      (BugService.getBugs as jest.Mock).mockResolvedValue(mockBugs);

      const response = await request(app)
        .get('/api/bugs?status=RESOLVED&page=1&limit=10&projectId=project-1')
        .expect(200);

      expect(BugService.getBugs).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'RESOLVED',
          projectId: 'project-1'
        }),
        expect.objectContaining({
          page: 1,
          limit: 10
        }),
        'test-user-id'
      );
    });

    it('should handle service errors', async () => {
      (BugService.getBugs as jest.Mock).mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/bugs')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/bugs/:id', () => {
    it('should get bug by id successfully', async () => {
      const mockBug = {
        id: '1',
        title: 'Test Bug',
        description: 'Test Description',
        status: 'NEW'
      };

      (BugService.getBugById as jest.Mock).mockResolvedValue(mockBug);

      const response = await request(app)
        .get('/api/bugs/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBug);
      expect(BugService.getBugById).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should return 404 for non-existent bug', async () => {
      (BugService.getBugById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/bugs/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Bug not found');
    });
  });

  describe('POST /api/bugs', () => {
    it('should create bug successfully', async () => {
      const mockBugData = {
        projectId: 'project-1',
        title: 'New Bug',
        description: 'Bug Description',
        priority: 'HIGH',
        severity: 'MAJOR'
      };

      const mockCreatedBug = {
        id: '1',
        ...mockBugData,
        reporterId: 'test-user-id',
        status: 'NEW'
      };

      (BugService.createBug as jest.Mock).mockResolvedValue(mockCreatedBug);

      const response = await request(app)
        .post('/api/bugs')
        .send(mockBugData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCreatedBug);
      expect(BugService.createBug).toHaveBeenCalledWith(mockBugData, 'test-user-id');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/bugs')
        .send({
          title: 'Bug without project'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should handle service errors', async () => {
      (BugService.createBug as jest.Mock).mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/bugs')
        .send({
          projectId: 'project-1',
          title: 'New Bug',
          description: 'Bug Description'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/bugs/:id', () => {
    it('should update bug successfully', async () => {
      const mockUpdateData = {
        title: 'Updated Bug',
        status: 'RESOLVED'
      };

      const mockUpdatedBug = {
        id: '1',
        ...mockUpdateData,
        description: 'Original description'
      };

      (BugService.updateBug as jest.Mock).mockResolvedValue(mockUpdatedBug);

      const response = await request(app)
        .put('/api/bugs/1')
        .send(mockUpdateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedBug);
      expect(BugService.updateBug).toHaveBeenCalledWith('1', mockUpdateData, 'test-user-id');
    });

    it('should return 404 for non-existent bug', async () => {
      (BugService.updateBug as jest.Mock).mockRejectedValue(new Error('Bug not found'));

      const response = await request(app)
        .put('/api/bugs/999')
        .send({ title: 'Updated Bug' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/bugs/:id', () => {
    it('should delete bug successfully', async () => {
      (BugService.deleteBug as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/bugs/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Bug deleted successfully');
      expect(BugService.deleteBug).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should handle service errors', async () => {
      (BugService.deleteBug as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      const response = await request(app)
        .delete('/api/bugs/1')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bugs/:id/watchers', () => {
    it('should add watcher successfully', async () => {
      (BugService.addWatcher as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/bugs/1/watchers')
        .send({ userId: 'user-2' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Watcher added successfully');
      expect(BugService.addWatcher).toHaveBeenCalledWith('1', 'test-user-id', 'user-2');
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/api/bugs/1/watchers')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User ID is required');
    });
  });

  describe('DELETE /api/bugs/:id/watchers/:userId', () => {
    it('should remove watcher successfully', async () => {
      (BugService.removeWatcher as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/bugs/1/watchers/user-2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Watcher removed successfully');
      expect(BugService.removeWatcher).toHaveBeenCalledWith('1', 'test-user-id', 'user-2');
    });

    it('should handle service errors', async () => {
      (BugService.removeWatcher as jest.Mock).mockRejectedValue(new Error('Remove failed'));

      const response = await request(app)
        .delete('/api/bugs/1/watchers/user-2')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});