import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Bug as BugIcon, Search } from 'lucide-react';
import { BugStatus, BugPriority } from '../types';
import type { BugFilters } from '../types';
import { BugCard } from './BugCard';
import { Pagination } from './Pagination';
import { Input } from './ui/input';
import { Label } from './ui/label';
import bugService from '../services/bug.service';
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
                placeholder="Search bugs..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status filter */}
          <div>
            <Label htmlFor="status">Status</Label>
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
            <Label htmlFor="priority">Priority</Label>
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