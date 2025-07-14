import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import projectService from '@/services/project.service';
import { useAuth } from '@/contexts/AuthContext';

export default function EditProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  });

  // Fetch project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProjectById(projectId!),
    enabled: !!projectId,
  });

  // Populate form when project data is loaded
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        isPublic: project.isPublic,
      });
    }
  }, [project]);

  const updateProjectMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      projectService.updateProject(projectId!, data),
    onSuccess: () => {
      toast({
        title: 'Project updated',
        description: 'The project has been successfully updated.',
        type: 'success',
      });
      navigate(`/projects/${projectId}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update project.',
        type: 'error',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProjectMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Project not found.</p>
        <Button onClick={() => navigate('/projects')} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  // Check permissions
  const canEditProject = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER' || user?.id === project.leadId;
  if (!canEditProject) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">You don't have permission to edit this project.</p>
        <Button onClick={() => navigate(`/projects/${projectId}`)} className="mt-4">
          Back to Project
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <h1 className="text-2xl font-bold">Edit Project</h1>
        <p className="text-sm text-gray-500 font-mono mt-1">{project.key}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* Project Name */}
          <div className="mb-4">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Enter project name"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the purpose and goals of this project..."
              rows={4}
            />
          </div>

          {/* Public/Private Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isPublic">Public Project</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Public projects can be viewed by all users
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPublic: checked })
                }
              />
            </div>
          </div>

          {/* Project Info */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium mb-3">Project Information</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd>{new Date(project.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Updated</dt>
                <dd>{new Date(project.updatedAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Total Bugs</dt>
                <dd>{project._count?.bugs || 0}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Team Members</dt>
                <dd>{project._count?.members || 0}</dd>
              </div>
            </dl>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Project
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}