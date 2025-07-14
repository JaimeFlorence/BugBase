import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Bug } from 'lucide-react';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-primary/80 items-center justify-center text-white p-8">
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <Bug className="h-24 w-24" />
          </div>
          <h1 className="text-4xl font-bold mb-4">BugBase</h1>
          <p className="text-xl opacity-90">Track, manage, and resolve bugs efficiently</p>
        </div>
      </div>
    </div>
  );
}