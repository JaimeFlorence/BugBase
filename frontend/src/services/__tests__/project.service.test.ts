import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock the api before importing the project service
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../api';
import projectService from '../project.service';
import type { Project, PaginationParams } from '../../types';

const mockApi = api as any;

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProject: Project = {
    id: '1',
    name: 'Test Project',
    key: 'TEST',
    description: 'Test project description',
    isPublic: true,
    ownerId: 'user-1',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    owner: {
      id: 'user-1',
      username: 'owner',
      fullName: 'Project Owner',
      email: 'owner@example.com'
    },
    members: [],
    _count: {
      bugs: 5,
      members: 2
    }
  };

  const mockMember = {
    id: 'member-1',
    userId: 'user-2',
    projectId: '1',
    role: 'DEVELOPER',
    joinedAt: new Date('2023-01-01'),
    user: {
      id: 'user-2',
      username: 'developer',
      fullName: 'Project Developer',
      email: 'dev@example.com'
    }
  };

  describe('getProjects', () => {
    it('should get projects with pagination', async () => {
      const pagination: PaginationParams = {
        page: 1,
        limit: 10
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            projects: [mockProject],
            pagination: {
              page: 1,
              limit: 10,
              totalCount: 1,
              totalPages: 1
            }
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await projectService.getProjects(pagination);

      expect(mockApi.get).toHaveBeenCalledWith('/projects', {
        params: pagination
      });
      expect(result.data).toEqual([mockProject]);
      expect(result.pagination.totalCount).toBe(1);
    });

    it('should get projects without pagination', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            projects: [mockProject],
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

      const result = await projectService.getProjects();

      expect(mockApi.get).toHaveBeenCalledWith('/projects', {
        params: undefined
      });
      expect(result.data).toEqual([mockProject]);
    });

    it('should handle get projects errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Failed to fetch projects'));

      await expect(projectService.getProjects())
        .rejects.toThrow('Failed to fetch projects');
    });
  });

  describe('getProjectById', () => {
    it('should get a single project by ID', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { project: mockProject }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await projectService.getProjectById('1');

      expect(mockApi.get).toHaveBeenCalledWith('/projects/1');
      expect(result).toEqual(mockProject);
    });

    it('should handle get project errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Project not found'));

      await expect(projectService.getProjectById('999'))
        .rejects.toThrow('Project not found');
    });
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const createData = {
        name: 'New Project',
        key: 'NEW',
        description: 'New project description',
        isPublic: true
      };

      const mockResponse = {
        data: {
          success: true,
          data: { project: mockProject }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await projectService.createProject(createData);

      expect(mockApi.post).toHaveBeenCalledWith('/projects', createData);
      expect(result).toEqual(mockProject);
    });

    it('should create a project with minimal data', async () => {
      const createData = {
        name: 'Minimal Project',
        key: 'MIN'
      };

      const mockResponse = {
        data: {
          success: true,
          data: { project: mockProject }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await projectService.createProject(createData);

      expect(mockApi.post).toHaveBeenCalledWith('/projects', createData);
      expect(result).toEqual(mockProject);
    });

    it('should handle creation errors', async () => {
      const createData = {
        name: 'New Project',
        key: 'NEW'
      };

      mockApi.post.mockRejectedValue(new Error('Project key already exists'));

      await expect(projectService.createProject(createData))
        .rejects.toThrow('Project key already exists');
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
        isPublic: false
      };

      const updatedProject = { ...mockProject, ...updateData };
      const mockResponse = {
        data: {
          success: true,
          data: { project: updatedProject }
        }
      };

      mockApi.put.mockResolvedValue(mockResponse);

      const result = await projectService.updateProject('1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/projects/1', updateData);
      expect(result).toEqual(updatedProject);
    });

    it('should update a project with partial data', async () => {
      const updateData = {
        name: 'Updated Name Only'
      };

      const updatedProject = { ...mockProject, name: 'Updated Name Only' };
      const mockResponse = {
        data: {
          success: true,
          data: { project: updatedProject }
        }
      };

      mockApi.put.mockResolvedValue(mockResponse);

      const result = await projectService.updateProject('1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/projects/1', updateData);
      expect(result).toEqual(updatedProject);
    });

    it('should handle update errors', async () => {
      const updateData = { name: 'Updated Project' };
      mockApi.put.mockRejectedValue(new Error('Update failed'));

      await expect(projectService.updateProject('1', updateData))
        .rejects.toThrow('Update failed');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      mockApi.delete.mockResolvedValue({});

      await projectService.deleteProject('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/1');
    });

    it('should handle delete errors', async () => {
      mockApi.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(projectService.deleteProject('1'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('getProjectMembers', () => {
    it('should get project members successfully', async () => {
      const mockMembers = [mockMember];
      const mockResponse = {
        data: {
          success: true,
          data: { members: mockMembers }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await projectService.getProjectMembers('1');

      expect(mockApi.get).toHaveBeenCalledWith('/projects/1/members');
      expect(result).toEqual(mockMembers);
    });

    it('should handle get members errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Failed to fetch members'));

      await expect(projectService.getProjectMembers('1'))
        .rejects.toThrow('Failed to fetch members');
    });
  });

  describe('addProjectMember', () => {
    it('should add a project member successfully', async () => {
      mockApi.post.mockResolvedValue({});

      await projectService.addProjectMember('project-1', 'user-1', 'DEVELOPER');

      expect(mockApi.post).toHaveBeenCalledWith('/projects/project-1/members', {
        userId: 'user-1',
        role: 'DEVELOPER'
      });
    });

    it('should handle add member errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Failed to add member'));

      await expect(projectService.addProjectMember('project-1', 'user-1', 'DEVELOPER'))
        .rejects.toThrow('Failed to add member');
    });
  });

  describe('removeProjectMember', () => {
    it('should remove a project member successfully', async () => {
      mockApi.delete.mockResolvedValue({});

      await projectService.removeProjectMember('project-1', 'user-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/project-1/members/user-1');
    });

    it('should handle remove member errors', async () => {
      mockApi.delete.mockRejectedValue(new Error('Failed to remove member'));

      await expect(projectService.removeProjectMember('project-1', 'user-1'))
        .rejects.toThrow('Failed to remove member');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      mockApi.put.mockResolvedValue({});

      await projectService.updateMemberRole('project-1', 'user-1', 'ADMIN');

      expect(mockApi.put).toHaveBeenCalledWith('/projects/project-1/members/user-1', {
        role: 'ADMIN'
      });
    });

    it('should handle update role errors', async () => {
      mockApi.put.mockRejectedValue(new Error('Failed to update role'));

      await expect(projectService.updateMemberRole('project-1', 'user-1', 'ADMIN'))
        .rejects.toThrow('Failed to update role');
    });
  });
});