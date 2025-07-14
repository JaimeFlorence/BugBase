import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import projectService from '@/services/project.service';
import { useAuth } from '@/contexts/AuthContext';

export default function CreateProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    isPublic: false,
  });

  // Auto-generate key from name
  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      key: name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10),
    });
  };

  const createProjectMutation = useMutation({
    mutationFn: (data: typeof formData) => projectService.createProject(data),
    onSuccess: (project) => {
      toast({
        title: 'Project created',
        description: 'Your project has been successfully created.',
        type: 'success',
      });
      navigate(`/projects/${project.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create project.',
        type: 'error',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProjectMutation.mutate(formData);
  };

  // Check permissions
  const canCreateProject = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
  if (!canCreateProject) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">You don't have permission to create projects.</p>
        <Button onClick={() => navigate('/projects')} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <h1 className="text-2xl font-bold">Create New Project</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* Project Name */}
          <div className="mb-4">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="Enter project name"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be the display name for your project
            </p>
          </div>

          {/* Project Key */}
          <div className="mb-4">
            <Label htmlFor="key">Project Key *</Label>
            <Input
              id="key"
              value={formData.key}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                })
              }
              required
              placeholder="e.g., PROJ"
              maxLength={10}
              className="font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              A unique identifier for your project (3-10 characters, letters and numbers only)
            </p>
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

          {/* Form Actions */}
          <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/projects')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}