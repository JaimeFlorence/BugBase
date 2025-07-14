import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Bell,
  Shield,
  Palette,
  Lock,
  Mail,
  Globe,
  Save,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface NotificationSettings {
  emailNotifications: boolean;
  bugAssigned: boolean;
  bugStatusChanged: boolean;
  bugCommented: boolean;
  projectInvite: boolean;
  weeklyDigest: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'team';
  showEmail: boolean;
  showActivity: boolean;
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    bugAssigned: true,
    bugStatusChanged: true,
    bugCommented: true,
    projectInvite: true,
    weeklyDigest: false,
  });

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    profileVisibility: 'team',
    showEmail: false,
    showActivity: true,
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      // In a real app, this would call an API endpoint
      if (data.newPassword !== data.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      if (data.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast({
        title: 'Password updated',
        description: 'Your password has been successfully changed.',
        type: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update password.',
        type: 'error',
      });
    },
  });

  // Save notification settings mutation
  const saveNotificationsMutation = useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return settings;
    },
    onSuccess: () => {
      toast({
        title: 'Notifications updated',
        description: 'Your notification preferences have been saved.',
        type: 'success',
      });
    },
  });

  // Save privacy settings mutation
  const savePrivacyMutation = useMutation({
    mutationFn: async (settings: PrivacySettings) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return settings;
    },
    onSuccess: () => {
      toast({
        title: 'Privacy settings updated',
        description: 'Your privacy preferences have been saved.',
        type: 'success',
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePasswordMutation.mutate(passwordData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Choose how BugBase looks to you
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <Label htmlFor="language">Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select defaultValue="utc">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="est">Eastern Time</SelectItem>
                    <SelectItem value="cst">Central Time</SelectItem>
                    <SelectItem value="mst">Mountain Time</SelectItem>
                    <SelectItem value="pst">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </h2>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative mt-2">
                  <Input
                    id="currentPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be at least 8 characters
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>

              <Button
                type="submit"
                disabled={updatePasswordMutation.isPending}
              >
                {updatePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Add an extra layer of security to your account
            </p>
            <Button variant="outline">
              Enable Two-Factor Authentication
            </Button>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Email Notifications
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-gray-500">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-medium">Activity Notifications</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="bugAssigned">Bug Assigned</Label>
                    <p className="text-sm text-gray-500">
                      When a bug is assigned to you
                    </p>
                  </div>
                  <Switch
                    id="bugAssigned"
                    checked={notificationSettings.bugAssigned}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, bugAssigned: checked })
                    }
                    disabled={!notificationSettings.emailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="bugStatusChanged">Bug Status Changed</Label>
                    <p className="text-sm text-gray-500">
                      When a bug you're watching changes status
                    </p>
                  </div>
                  <Switch
                    id="bugStatusChanged"
                    checked={notificationSettings.bugStatusChanged}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, bugStatusChanged: checked })
                    }
                    disabled={!notificationSettings.emailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="bugCommented">New Comments</Label>
                    <p className="text-sm text-gray-500">
                      When someone comments on your bugs
                    </p>
                  </div>
                  <Switch
                    id="bugCommented"
                    checked={notificationSettings.bugCommented}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, bugCommented: checked })
                    }
                    disabled={!notificationSettings.emailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="projectInvite">Project Invitations</Label>
                    <p className="text-sm text-gray-500">
                      When you're invited to a project
                    </p>
                  </div>
                  <Switch
                    id="projectInvite"
                    checked={notificationSettings.projectInvite}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, projectInvite: checked })
                    }
                    disabled={!notificationSettings.emailNotifications}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="weeklyDigest">Weekly Digest</Label>
                  <p className="text-sm text-gray-500">
                    Summary of your activity and updates
                  </p>
                </div>
                <Switch
                  id="weeklyDigest"
                  checked={notificationSettings.weeklyDigest}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, weeklyDigest: checked })
                  }
                  disabled={!notificationSettings.emailNotifications}
                />
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => saveNotificationsMutation.mutate(notificationSettings)}
                  disabled={saveNotificationsMutation.isPending}
                >
                  {saveNotificationsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Notifications
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Privacy Settings */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Privacy
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="profileVisibility">Profile Visibility</Label>
                <Select
                  value={privacySettings.profileVisibility}
                  onValueChange={(value: any) =>
                    setPrivacySettings({ ...privacySettings, profileVisibility: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="team">Team Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Control who can see your profile information
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showEmail">Show Email Address</Label>
                  <p className="text-sm text-gray-500">
                    Display your email on your profile
                  </p>
                </div>
                <Switch
                  id="showEmail"
                  checked={privacySettings.showEmail}
                  onCheckedChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showEmail: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showActivity">Show Activity</Label>
                  <p className="text-sm text-gray-500">
                    Display your recent activity on your profile
                  </p>
                </div>
                <Switch
                  id="showActivity"
                  checked={privacySettings.showActivity}
                  onCheckedChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showActivity: checked })
                  }
                />
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => savePrivacyMutation.mutate(privacySettings)}
                  disabled={savePrivacyMutation.isPending}
                >
                  {savePrivacyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Privacy Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-red-200 dark:border-red-900">
            <h2 className="text-xl font-semibold mb-4 text-red-600">
              Danger Zone
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Button variant="outline" className="text-red-600 hover:text-red-700">
              Delete Account
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}