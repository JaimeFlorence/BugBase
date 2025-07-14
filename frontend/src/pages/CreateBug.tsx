import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { BugPriority, BugSeverity } from '@/types';
import type { CreateBugData } from '@/types';
import bugService from '@/services/bug.service';
import projectService from '@/services/project.service';

export default function CreateBug() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateBugData>({
    projectId: '',
    title: '',
    description: '',
    priority: BugPriority.MEDIUM,
    severity: BugSeverity.MINOR,
  });

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getProjects(),
  });

  const createBugMutation = useMutation({
    mutationFn: (data: CreateBugData) => bugService.createBug(data),
    onSuccess: (bug) => {
      toast({
        title: 'Bug created',
        description: 'The bug has been successfully created.',
        type: 'success',
      });
      navigate(`/bugs/${bug.id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create bug. Please try again.',
        type: 'error',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.projectId && formData.title && formData.description) {
      createBugMutation.mutate(formData);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          to="/bugs"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bugs
        </Link>
        <h1 className="text-2xl font-bold">Create New Bug</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {/* Project */}
          <div>
            <Label htmlFor="project">Project *</Label>
            <Select
              id="project"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              required
            >
              <option value="">Select a project</option>
              {projectsData?.data.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter bug title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the bug in detail..."
              className="min-h-[150px]"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as BugPriority })}
              >
                {Object.values(BugPriority).map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </Select>
            </div>

            {/* Severity */}
            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select
                id="severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as BugSeverity })}
              >
                {Object.values(BugSeverity).map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Environment */}
          <div>
            <Label htmlFor="environment">Environment</Label>
            <Input
              id="environment"
              type="text"
              value={formData.environment || ''}
              onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
              placeholder="e.g., Production, Staging, Development"
            />
          </div>

          {/* Version Found */}
          <div>
            <Label htmlFor="versionFound">Version Found</Label>
            <Input
              id="versionFound"
              type="text"
              value={formData.versionFound || ''}
              onChange={(e) => setFormData({ ...formData, versionFound: e.target.value })}
              placeholder="e.g., v1.2.3"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/bugs')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createBugMutation.isPending}>
            {createBugMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Bug
          </Button>
        </div>
      </form>
    </div>
  );
}