import { useAuth } from '@/contexts/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <div className="rounded-lg border bg-card p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <dl className="space-y-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Full Name</dt>
            <dd className="text-sm">{user?.fullName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Username</dt>
            <dd className="text-sm">@{user?.username}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Email</dt>
            <dd className="text-sm">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Role</dt>
            <dd className="text-sm capitalize">{user?.role.toLowerCase().replace('_', ' ')}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}