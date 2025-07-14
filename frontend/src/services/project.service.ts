import api from './api';
import type {
  Project,
  ApiResponse,
  PaginatedResponse,
  PaginationParams
} from '../types';

class ProjectService {
  // Get all projects
  async getProjects(
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Project>> {
    const response = await api.get<ApiResponse<{
      projects: Project[];
      pagination: PaginatedResponse<Project>['pagination'];
    }>>('/projects', { params: pagination });
    
    return {
      data: response.data.data!.projects,
      pagination: response.data.data!.pagination
    };
  }

  // Get a single project by ID
  async getProjectById(id: string): Promise<Project> {
    const response = await api.get<ApiResponse<{ project: Project }>>(`/projects/${id}`);
    return response.data.data!.project;
  }

  // Create a new project
  async createProject(data: {
    name: string;
    key: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<Project> {
    const response = await api.post<ApiResponse<{ project: Project }>>('/projects', data);
    return response.data.data!.project;
  }

  // Update a project
  async updateProject(id: string, data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<Project> {
    const response = await api.put<ApiResponse<{ project: Project }>>(`/projects/${id}`, data);
    return response.data.data!.project;
  }

  // Delete a project
  async deleteProject(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  }

  // Get project members
  async getProjectMembers(projectId: string): Promise<any[]> {
    const response = await api.get<ApiResponse<{ members: any[] }>>(
      `/projects/${projectId}/members`
    );
    return response.data.data!.members;
  }

  // Add a member to project
  async addProjectMember(projectId: string, userId: string, role: string): Promise<void> {
    await api.post(`/projects/${projectId}/members`, { userId, role });
  }

  // Remove a member from project
  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await api.delete(`/projects/${projectId}/members/${userId}`);
  }

  // Update member role
  async updateMemberRole(projectId: string, userId: string, role: string): Promise<void> {
    await api.put(`/projects/${projectId}/members/${userId}`, { role });
  }
}

export default new ProjectService();