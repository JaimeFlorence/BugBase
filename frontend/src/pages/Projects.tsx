import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Folder,
  Users,
  Bug,
  Calendar,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Lock,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import projectService from '@/services/project.service';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import type { Project } from '@/types';

export default function Projects() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', page],
    queryFn: () => projectService.getProjects({ page, limit }),
  });

  const filteredProjects = data?.data.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const canCreateProject = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load projects.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        {canCreateProject && (
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Projects grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No projects found.</p>
          {canCreateProject && searchTerm === '' && (
            <Button asChild className="mt-4">
              <Link to="/projects/new">
                <Plus className="h-4 w-4 mr-2" />
                Create your first project
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <Link
                    to={`/projects/${project.id}`}
                    className="text-lg font-semibold hover:text-primary transition-colors"
                  >
                    {project.name}
                  </Link>
                  <p className="text-sm text-gray-500 font-mono">{project.key}</p>
                </div>
                <div className="flex items-center gap-2">
                  {project.isPublic ? (
                    <Globe className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                  {(user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/projects/${project.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {project.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Bug className="h-4 w-4" />
                  <span>{project._count?.bugs || 0} bugs</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  <span>{project._count?.members || 0} members</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
                </div>
              </div>

              {project.lead && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500">Project Lead</p>
                  <p className="text-sm font-medium">
                    {project.lead.fullName || project.lead.username}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page === data.pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}