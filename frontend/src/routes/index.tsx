import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy load all route components for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const BugList = lazy(() => import('@/pages/bugs/BugList'));
const BugDetail = lazy(() => import('@/pages/bugs/BugDetail'));
const CreateBug = lazy(() => import('@/pages/bugs/CreateBug'));
const EditBug = lazy(() => import('@/pages/bugs/EditBug'));
const ProjectList = lazy(() => import('@/pages/projects/ProjectList'));
const ProjectDetail = lazy(() => import('@/pages/projects/ProjectDetail'));
const CreateProject = lazy(() => import('@/pages/projects/CreateProject'));
const EditProject = lazy(() => import('@/pages/projects/EditProject'));
const UserProfile = lazy(() => import('@/pages/users/UserProfile'));
const UserSettings = lazy(() => import('@/pages/users/UserSettings'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Loading component for route transitions
const RouteLoading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" />
  </div>
);

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public route wrapper (redirects to dashboard if already authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          
          {/* Bug routes */}
          <Route path="bugs">
            <Route index element={<BugList />} />
            <Route path="new" element={<CreateBug />} />
            <Route path=":id" element={<BugDetail />} />
            <Route path=":id/edit" element={<EditBug />} />
          </Route>
          
          {/* Project routes */}
          <Route path="projects">
            <Route index element={<ProjectList />} />
            <Route path="new" element={<CreateProject />} />
            <Route path=":id" element={<ProjectDetail />} />
            <Route path=":id/edit" element={<EditProject />} />
          </Route>
          
          {/* User routes */}
          <Route path="profile" element={<UserProfile />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

// Preload critical routes
export const preloadCriticalRoutes = () => {
  // Preload dashboard and bug list as they're most commonly accessed
  import('@/pages/Dashboard');
  import('@/pages/bugs/BugList');
};