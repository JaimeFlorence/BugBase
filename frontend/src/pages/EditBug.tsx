import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import bugService from '@/services/bug.service';
import projectService from '@/services/project.service';
import { useAuth } from '@/contexts/AuthContext';
import type { BugStatus, BugPriority, BugSeverity } from '@/types';

export default function EditBug() {
  const { bugId } = useParams<{ bugId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'OPEN' as BugStatus,
    priority: 'MEDIUM' as BugPriority,
    severity: 'MEDIUM' as BugSeverity,
    projectId: '',
    assigneeId: '',
    environment: '',
    versionFound: '',
    versionFixed: '',
    estimatedHours: '',
    actualHours: '',
    dueDate: '',
  });

  // Fetch bug details
  const { data: bug, isLoading: bugLoading } = useQuery({
    queryKey: ['bug', bugId],
    queryFn: () => bugService.getBugById(bugId!),
    enabled: !!bugId,
  });

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getProjects({ page: 1, limit: 100 }),
  });

  // Fetch project members for assignee dropdown
  const { data: projectMembers } = useQuery({
    queryKey: ['project-members', formData.projectId],
    queryFn: () => projectService.getProjectMembers(formData.projectId),
    enabled: !!formData.projectId,
  });

  // Populate form when bug data is loaded
  useEffect(() => {
    if (bug) {
      setFormData({
        title: bug.title,
        description: bug.description,
        status: bug.status,
        priority: bug.priority,
        severity: bug.severity,
        projectId: bug.projectId,
        assigneeId: bug.assigneeId || '',
        environment: bug.environment || '',
        versionFound: bug.versionFound || '',
        versionFixed: bug.versionFixed || '',
        estimatedHours: bug.estimatedHours?.toString() || '',
        actualHours: bug.actualHours?.toString() || '',
        dueDate: bug.dueDate ? new Date(bug.dueDate).toISOString().split('T')[0] : '',
      });
    }
  }, [bug]);

  // Update mutation
  const updateBugMutation = useMutation({
    mutationFn: (data: any) => bugService.updateBug(bugId!, data),
    onSuccess: () => {
      toast({
        title: 'Bug updated',
        description: 'The bug has been successfully updated.',
        type: 'success',
      });
      navigate(`/bugs/${bugId}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update bug.',
        type: 'error',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data for submission
    const submitData: any = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      severity: formData.severity,
      projectId: formData.projectId,
      assigneeId: formData.assigneeId || null,
      environment: formData.environment || null,
      versionFound: formData.versionFound || null,
      versionFixed: formData.versionFixed || null,
      estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
      actualHours: formData.actualHours ? parseFloat(formData.actualHours) : null,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    };

    updateBugMutation.mutate(submitData);
  };

  if (bugLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bug) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Bug not found.</p>
        <Button onClick={() => navigate('/bugs')} className="mt-4">
          Back to Bugs
        </Button>
      </div>
    );
  }

  // Check permissions
  const canEdit = user?.id === bug.reporterId || user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
  if (!canEdit) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">You don't have permission to edit this bug.</p>
        <Button onClick={() => navigate(`/bugs/${bugId}`)} className="mt-4">
          Back to Bug
        </Button>
      </div>
    );
  }

  const bugReference = `${bug.project?.key || 'BUG'}-${bug.bugNumber}`;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          to={`/bugs/${bugId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bug
        </Link>
        <h1 className="text-2xl font-bold">Edit Bug {bugReference}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* Title */}
          <div className="mb-4">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Enter bug title"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder="Describe the bug in detail"
              rows={6}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Project */}
            <div>
              <Label htmlFor="project">Project *</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) => setFormData({ ...formData, projectId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projectsData?.data.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <Select
                value={formData.assigneeId}
                onValueChange={(value) => setFormData({ ...formData, assigneeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {projectMembers?.map((member) => (
                    <SelectItem key={member.user.id} value={member.user.id}>
                      {member.user.fullName || member.user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Status */}
            <div>
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as BugStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="IN_REVIEW">In Review</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="REOPENED">Reopened</SelectItem>
                  <SelectItem value="DUPLICATE">Duplicate</SelectItem>
                  <SelectItem value="WONT_FIX">Won't Fix</SelectItem>
                  <SelectItem value="CANNOT_REPRODUCE">Cannot Reproduce</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as BugPriority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Severity */}
            <div>
              <Label htmlFor="severity">Severity *</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) => setFormData({ ...formData, severity: value as BugSeverity })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLOCKER">Blocker</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="MAJOR">Major</SelectItem>
                  <SelectItem value="MINOR">Minor</SelectItem>
                  <SelectItem value="TRIVIAL">Trivial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Environment */}
            <div>
              <Label htmlFor="environment">Environment</Label>
              <Input
                id="environment"
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                placeholder="e.g., Production, Staging"
              />
            </div>

            {/* Version Found */}
            <div>
              <Label htmlFor="versionFound">Version Found</Label>
              <Input
                id="versionFound"
                value={formData.versionFound}
                onChange={(e) => setFormData({ ...formData, versionFound: e.target.value })}
                placeholder="e.g., 1.0.0"
              />
            </div>

            {/* Version Fixed */}
            <div>
              <Label htmlFor="versionFixed">Version Fixed</Label>
              <Input
                id="versionFixed"
                value={formData.versionFixed}
                onChange={(e) => setFormData({ ...formData, versionFixed: e.target.value })}
                placeholder="e.g., 1.0.1"
              />
            </div>

            {/* Due Date */}
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            {/* Estimated Hours */}
            <div>
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                step="0.5"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                placeholder="e.g., 8"
              />
            </div>

            {/* Actual Hours */}
            <div>
              <Label htmlFor="actualHours">Actual Hours</Label>
              <Input
                id="actualHours"
                type="number"
                step="0.5"
                value={formData.actualHours}
                onChange={(e) => setFormData({ ...formData, actualHours: e.target.value })}
                placeholder="e.g., 10"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/bugs/${bugId}`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateBugMutation.isPending}
            >
              {updateBugMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Bug
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}