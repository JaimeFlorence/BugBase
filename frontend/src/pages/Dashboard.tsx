import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="text-muted-foreground">Welcome back, {user?.fullName}!</p>
      
      <div className="grid gap-6 mt-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">Total Bugs</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">Open Bugs</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">In Progress</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">Resolved</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>
    </div>
  );
}