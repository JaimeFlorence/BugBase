import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Bug, 
  MessageSquare, 
  Eye,
  Edit,
  Save,
  X,
  Loader2,
  Activity,
  Clock,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import bugService from '@/services/bug.service';
import type { Bug } from '@/types';

interface UserStats {
  totalBugsReported: number;
  totalBugsAssigned: number;
  totalBugsResolved: number;
  totalComments: number;
  totalProjectsInvolved: number;
  recentActivity: Array<{
    id: string;
    type: 'bug_created' | 'bug_updated' | 'comment_added' | 'bug_resolved';
    bugId: string;
    bugTitle: string;
    timestamp: string;
  }>;
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    fullName: user?.fullName || '',
    username: user?.username || '',
  });

  // Fetch user's reported bugs
  const { data: reportedBugs } = useQuery({
    queryKey: ['user-reported-bugs', user?.id],
    queryFn: () => bugService.getBugs({ reporterId: user?.id }, { page: 1, limit: 5 }),
    enabled: !!user?.id,
  });

  // Fetch user's assigned bugs
  const { data: assignedBugs } = useQuery({
    queryKey: ['user-assigned-bugs', user?.id],
    queryFn: () => bugService.getBugs({ assigneeId: user?.id }, { page: 1, limit: 5 }),
    enabled: !!user?.id,
  });

  // Mock user stats - in a real app, this would come from an API endpoint
  const userStats: UserStats = {
    totalBugsReported: reportedBugs?.pagination.total || 0,
    totalBugsAssigned: assignedBugs?.pagination.total || 0,
    totalBugsResolved: 0, // Would need a filtered query
    totalComments: 0, // Would need a comment count endpoint
    totalProjectsInvolved: 0, // Would need a project count endpoint
    recentActivity: []
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName: string; username: string }) => {
      // In a real app, this would call an API endpoint
      // For now, we'll just update the local state
      return data;
    },
    onSuccess: (data) => {
      updateUser({ ...user!, ...data });
      setIsEditing(false);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
        type: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        type: 'error',
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(editData);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({
      fullName: user?.fullName || '',
      username: user?.username || '',
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'PROJECT_MANAGER':
        return 'default';
      case 'DEVELOPER':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info Card */}
        <Card className="p-6 lg:col-span-1">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">User Information</h2>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl font-bold">
                {user.fullName?.charAt(0) || user.username.charAt(0)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={editData.fullName}
                    onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={editData.username}
                    onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </p>
                  <p className="font-medium">{user.fullName || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Username
                  </p>
                  <p className="font-medium">@{user.username}</p>
                </div>
              </>
            )}

            <div>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </p>
              <p className="font-medium">{user.email}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                Role
              </p>
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {user.role.replace('_', ' ')}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Member Since
              </p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        </Card>

        {/* Stats and Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="h-4 w-4 text-gray-500" />
                <p className="text-sm text-gray-500">Reported</p>
              </div>
              <p className="text-2xl font-bold">{userStats.totalBugsReported}</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-gray-500" />
                <p className="text-sm text-gray-500">Assigned</p>
              </div>
              <p className="text-2xl font-bold">{userStats.totalBugsAssigned}</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-gray-500" />
                <p className="text-sm text-gray-500">Resolved</p>
              </div>
              <p className="text-2xl font-bold">{userStats.totalBugsResolved}</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                <p className="text-sm text-gray-500">Comments</p>
              </div>
              <p className="text-2xl font-bold">{userStats.totalComments}</p>
            </Card>
          </div>

          {/* Tabs for Bugs */}
          <Card className="p-6">
            <Tabs defaultValue="reported">
              <TabsList className="mb-4">
                <TabsTrigger value="reported">Reported Bugs</TabsTrigger>
                <TabsTrigger value="assigned">Assigned Bugs</TabsTrigger>
                <TabsTrigger value="watching">Watching</TabsTrigger>
              </TabsList>

              <TabsContent value="reported" className="space-y-3">
                {reportedBugs?.data.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No bugs reported yet.</p>
                ) : (
                  reportedBugs?.data.map((bug: Bug) => (
                    <div key={bug.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex-1">
                        <a
                          href={`/bugs/${bug.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {bug.title}
                        </a>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {bug.project?.key}-{bug.bugNumber}
                          </span>
                          <StatusBadge status={bug.status} />
                          <PriorityBadge priority={bug.priority} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="assigned" className="space-y-3">
                {assignedBugs?.data.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No bugs assigned to you.</p>
                ) : (
                  assignedBugs?.data.map((bug: Bug) => (
                    <div key={bug.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex-1">
                        <a
                          href={`/bugs/${bug.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {bug.title}
                        </a>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {bug.project?.key}-{bug.bugNumber}
                          </span>
                          <StatusBadge status={bug.status} />
                          <PriorityBadge priority={bug.priority} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="watching" className="space-y-3">
                <p className="text-center text-gray-500 py-8">
                  Watching functionality coming soon.
                </p>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </h3>
            {userStats.recentActivity.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {/* Activity items would go here */}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}