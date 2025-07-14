import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bug as BugIcon, Search, SlidersHorizontal } from 'lucide-react';
import { BugStatus, BugPriority, BugSeverity } from '../types';
import type { BugFilters, Bug } from '../types';
import { BugCard } from './BugCard';
import { Pagination } from './Pagination';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import bugService from '../services/bug.service';
import { useSocket } from '../contexts/SocketContext';
import { cn } from '../lib/utils';

interface BugListProps {
  projectId?: string;
  filters?: BugFilters;
  className?: string;
}

export function BugList({ projectId, filters: initialFilters = {}, className }: BugListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<BugFilters>({
    ...initialFilters,
    projectId
  });
  const { socket, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();

  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['bugs', filters, page, limit],
    queryFn: () => bugService.getBugs(filters, { page, limit }),
  });

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      ...initialFilters,
      projectId
    }));
  }, [projectId, initialFilters]);

  // Join rooms for real-time updates
  useEffect(() => {
    if (socket) {
      // Join general bugs room
      const roomName = projectId ? `project:${projectId}:bugs` : 'bugs';
      joinRoom(roomName);

      // Listen for bug updates
      const handleBugUpdate = (updatedBug: Bug) => {
        queryClient.setQueryData(['bugs', filters, page, limit], (oldData: any) => {
          if (!oldData?.data) return oldData;
          
          return {
            ...oldData,
            data: oldData.data.map((bug: Bug) => 
              bug.id === updatedBug.id ? updatedBug : bug
            )
          };
        });
      };

      const handleNewBug = (newBug: Bug) => {
        // Refresh bug list when new bugs are created
        queryClient.invalidateQueries({ queryKey: ['bugs'] });
      };

      const handleBugDelete = (deletedBugId: string) => {
        queryClient.setQueryData(['bugs', filters, page, limit], (oldData: any) => {
          if (!oldData?.data) return oldData;
          
          return {
            ...oldData,
            data: oldData.data.filter((bug: Bug) => bug.id !== deletedBugId)
          };
        });
      };

      socket.on('bug:updated', handleBugUpdate);
      socket.on('bug:created', handleNewBug);
      socket.on('bug:deleted', handleBugDelete);

      return () => {
        socket.off('bug:updated', handleBugUpdate);
        socket.off('bug:created', handleNewBug);
        socket.off('bug:deleted', handleBugDelete);
        leaveRoom(roomName);
      };
    }
  }, [socket, projectId, joinRoom, leaveRoom, queryClient, filters, page, limit]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setFilters(prev => ({
      ...prev,
      search: value || undefined
    }));
    setPage(1);
  };

  const handleFilterChange = (key: keyof BugFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
    setPage(1);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <BugIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          Failed to load bugs. Please try again.
        </p>
      </div>
    );
  }

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <Label htmlFor="search" className="sr-only">Search bugs</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                type="search"
                placeholder="Search by title, description, or bug number..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status filter */}
          <div>
            <Label htmlFor="status" className="text-xs">Status</Label>
            <select
              id="status"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
            >
              <option value="">All Status</option>
              {Object.values(BugStatus).map(status => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <Label htmlFor="priority" className="text-xs">Priority</Label>
            <select
              id="priority"
              value={filters.priority || ''}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
            >
              <option value="">All Priorities</option>
              {Object.values(BugPriority).map(priority => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-xs"
          >
            <SlidersHorizontal className="h-3 w-3 mr-1" />
            {showAdvancedFilters ? 'Hide' : 'Show'} advanced filters
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Severity filter */}
              <div>
                <Label htmlFor="severity" className="text-xs">Severity</Label>
                <select
                  id="severity"
                  value={filters.severity || ''}
                  onChange={(e) => handleFilterChange('severity', e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
                >
                  <option value="">All Severities</option>
                  {Object.values(BugSeverity).map(severity => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee filter */}
              <div>
                <Label htmlFor="assignee" className="text-xs">Assignee</Label>
                <select
                  id="assignee"
                  value={filters.assigneeId || ''}
                  onChange={(e) => handleFilterChange('assigneeId', e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  disabled
                >
                  <option value="">All Assignees</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>

              {/* Reporter filter */}
              <div>
                <Label htmlFor="reporter" className="text-xs">Reporter</Label>
                <select
                  id="reporter"
                  value={filters.reporterId || ''}
                  onChange={(e) => handleFilterChange('reporterId', e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  disabled
                >
                  <option value="">All Reporters</option>
                </select>
              </div>

              {/* Sort by */}
              <div>
                <Label htmlFor="sortBy" className="text-xs">Sort by</Label>
                <select
                  id="sortBy"
                  className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  defaultValue="createdAt"
                >
                  <option value="createdAt">Created Date</option>
                  <option value="updatedAt">Updated Date</option>
                  <option value="priority">Priority</option>
                  <option value="severity">Severity</option>
                  <option value="bugNumber">Bug Number</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data?.data.length === 0 ? (
        <div className="text-center py-12">
          <BugIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No bugs found matching your filters.
          </p>
        </div>
      ) : (
        <>
          {/* Bug list */}
          <div className="space-y-3">
            {data?.data.map((bug) => (
              <BugCard key={bug.id} bug={bug} />
            ))}
          </div>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={data.pagination.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}