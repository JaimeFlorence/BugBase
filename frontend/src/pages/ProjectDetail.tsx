import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  Bug,
  Calendar,
  Lock,
  Globe,
  Plus,
  UserPlus,
  Settings,
  Loader2,
  MoreHorizontal,
  Shield,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import projectService from '@/services/project.service';
import bugService from '@/services/bug.service';
import { useAuth } from '@/contexts/AuthContext';
import type { Bug } from '@/types';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('DEVELOPER');

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProjectById(projectId!),
    enabled: !!projectId,
  });

  // Fetch project bugs
  const { data: bugsData } = useQuery({
    queryKey: ['project-bugs', projectId],
    queryFn: () => bugService.getBugs({ projectId: projectId! }, { page: 1, limit: 10 }),
    enabled: !!projectId && activeTab === 'bugs',
  });

  // Fetch project members
  const { data: members } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getProjectMembers(projectId!),
    enabled: !!projectId && activeTab === 'members',
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: () => projectService.deleteProject(projectId!),
    onSuccess: () => {
      toast({
        title: 'Project deleted',
        description: 'The project has been successfully deleted.',
        type: 'success',
      });
      navigate('/projects');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete project.',
        type: 'error',
      });
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      projectService.addProjectMember(projectId!, data.userId, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      setShowAddMemberDialog(false);
      setNewMemberEmail('');
      toast({
        title: 'Member added',
        description: 'New member has been added to the project.',
        type: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add member.',
        type: 'error',
      });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      projectService.removeProjectMember(projectId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({
        title: 'Member removed',
        description: 'Member has been removed from the project.',
        type: 'success',
      });
    },
  });

  if (projectLoading) {
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

  const canManageProject = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER' || user?.id === project.leadId;
  const canDeleteProject = user?.role === 'ADMIN';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <Badge variant="outline" className="font-mono">
                {project.key}
              </Badge>
              {project.isPublic ? (
                <Badge variant="secondary">
                  <Globe className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Lock className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 max-w-3xl">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button asChild>
              <Link to="/bugs/new">
                <Plus className="h-4 w-4 mr-2" />
                New Bug
              </Link>
            </Button>
            {canManageProject && (
              <>
                <Button variant="outline" asChild>
                  <Link to={`/projects/${projectId}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
                {canDeleteProject && (
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                        deleteProjectMutation.mutate();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bugs">Bugs</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stats */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Bug className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Total Bugs</h3>
              </div>
              <p className="text-3xl font-bold">{project._count?.bugs || 0}</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Team Members</h3>
              </div>
              <p className="text-3xl font-bold">{project._count?.members || 0}</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Created</h3>
              </div>
              <p className="text-lg">
                {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
              </p>
            </Card>
          </div>

          {/* Project Lead */}
          {project.lead && (
            <Card className="p-6 mt-6">
              <h3 className="font-semibold mb-4">Project Lead</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {project.lead.fullName?.charAt(0) || project.lead.username.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">
                    {project.lead.fullName || project.lead.username}
                  </p>
                  <p className="text-sm text-gray-500">{project.lead.email}</p>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Bugs Tab */}
        <TabsContent value="bugs">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Project Bugs</h2>
              <Button asChild>
                <Link to={`/bugs?projectId=${projectId}`}>
                  View All Bugs
                </Link>
              </Button>
            </div>

            {bugsData?.data.length === 0 ? (
              <Card className="p-12 text-center">
                <Bug className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No bugs found for this project.</p>
                <Button asChild>
                  <Link to="/bugs/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Bug
                  </Link>
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {bugsData?.data.map((bug: Bug) => (
                  <Card key={bug.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/bugs/${bug.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {bug.title}
                          </Link>
                          <StatusBadge status={bug.status} />
                          <PriorityBadge priority={bug.priority} />
                        </div>
                        <p className="text-sm text-gray-500">
                          {`${project.key}-${bug.bugNumber}`} • 
                          Opened {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })} by {bug.reporter?.fullName || bug.reporter?.username}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Team Members</h2>
              {canManageProject && (
                <Button onClick={() => setShowAddMemberDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              )}
            </div>

            {members?.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No team members yet.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {members?.map((member: any) => (
                  <Card key={member.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {member.user.fullName?.charAt(0) || member.user.username.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {member.user.fullName || member.user.username}
                          </p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          <Shield className="h-3 w-3 mr-1" />
                          {member.role}
                        </Badge>
                        {canManageProject && member.user.id !== project.leadId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  if (confirm('Are you sure you want to remove this member?')) {
                                    removeMemberMutation.mutate(member.user.id);
                                  }
                                }}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          {canManageProject ? (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Project Settings</h2>
              <div className="space-y-4">
                <Button variant="outline" asChild>
                  <Link to={`/projects/${projectId}/edit`}>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Project Details
                  </Link>
                </Button>
                {canDeleteProject && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Once you delete a project, there is no going back. Please be certain.
                    </p>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                          deleteProjectMutation.mutate();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete This Project
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <Lock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                You don't have permission to manage project settings.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to the project team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                  <SelectItem value="DEVELOPER">Developer</SelectItem>
                  <SelectItem value="TESTER">Tester</SelectItem>
                  <SelectItem value="LEAD">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // In a real app, we'd look up the user by email
                // For now, we'll just show an error
                toast({
                  title: 'Not implemented',
                  description: 'User lookup by email is not yet implemented.',
                  type: 'error',
                });
              }}
            >
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}