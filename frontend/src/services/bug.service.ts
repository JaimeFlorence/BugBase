import api from './api';
import type {
  Bug,
  BugFilters,
  PaginationParams,
  ApiResponse,
  PaginatedResponse,
  CreateBugData,
  UpdateBugData,
  BugStatistics
} from '../types';

class BugService {
  // Create a new bug
  async createBug(data: CreateBugData): Promise<Bug> {
    const response = await api.post<ApiResponse<{ bug: Bug }>>('/bugs', data);
    return response.data.data!.bug;
  }

  // Get bugs with filters and pagination
  async getBugs(
    filters?: BugFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Bug>> {
    const params = {
      ...filters,
      ...pagination
    };
    
    const response = await api.get<ApiResponse<{
      bugs: Bug[];
      pagination: PaginatedResponse<Bug>['pagination'];
    }>>('/bugs', { params });
    
    return {
      data: response.data.data!.bugs,
      pagination: response.data.data!.pagination
    };
  }

  // Get a single bug by ID
  async getBugById(id: string): Promise<Bug> {
    const response = await api.get<ApiResponse<{ bug: Bug }>>(`/bugs/${id}`);
    return response.data.data!.bug;
  }

  // Update a bug
  async updateBug(id: string, data: UpdateBugData): Promise<Bug> {
    const response = await api.put<ApiResponse<{ bug: Bug }>>(`/bugs/${id}`, data);
    return response.data.data!.bug;
  }

  // Delete a bug
  async deleteBug(id: string): Promise<void> {
    await api.delete(`/bugs/${id}`);
  }

  // Get bug statistics
  async getBugStatistics(projectId?: string): Promise<BugStatistics> {
    const params = projectId ? { projectId } : {};
    const response = await api.get<ApiResponse<{ statistics: BugStatistics }>>(
      '/bugs/statistics',
      { params }
    );
    return response.data.data!.statistics;
  }

  // Add a watcher to a bug
  async addWatcher(bugId: string, userId: string): Promise<void> {
    await api.post(`/bugs/${bugId}/watchers`, { userId });
  }

  // Remove a watcher from a bug
  async removeWatcher(bugId: string, userId: string): Promise<void> {
    await api.delete(`/bugs/${bugId}/watchers`, { data: { userId } });
  }

  // Helper methods for status
  isOpen(bug: Bug): boolean {
    return ['NEW', 'IN_PROGRESS', 'TESTING', 'REOPENED'].includes(bug.status);
  }

  isClosed(bug: Bug): boolean {
    return ['RESOLVED', 'CLOSED'].includes(bug.status);
  }

  // Helper method to format bug reference
  formatBugReference(bug: Bug): string {
    return `${bug.project?.key || 'BUG'}-${bug.bugNumber}`;
  }

  // Helper method to get status color
  getStatusColor(status: string): string {
    const colors = {
      NEW: 'blue',
      IN_PROGRESS: 'yellow',
      TESTING: 'purple',
      RESOLVED: 'green',
      CLOSED: 'gray',
      REOPENED: 'orange'
    };
    return colors[status as keyof typeof colors] || 'gray';
  }

  // Helper method to get priority color
  getPriorityColor(priority: string): string {
    const colors = {
      CRITICAL: 'red',
      HIGH: 'orange',
      MEDIUM: 'yellow',
      LOW: 'green'
    };
    return colors[priority as keyof typeof colors] || 'gray';
  }

  // Helper method to get severity color
  getSeverityColor(severity: string): string {
    const colors = {
      BLOCKER: 'red',
      MAJOR: 'orange',
      MINOR: 'yellow',
      TRIVIAL: 'green'
    };
    return colors[severity as keyof typeof colors] || 'gray';
  }
}

export default new BugService();