import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { Toaster } from '@/components/ui/toaster';

// Layouts
import MainLayout from '@/layouts/MainLayout';
import AuthLayout from '@/layouts/AuthLayout';

// Pages
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import CreateProject from '@/pages/CreateProject';
import EditProject from '@/pages/EditProject';
import Bugs from '@/pages/Bugs';
import BugDetail from '@/pages/BugDetail';
import CreateBug from '@/pages/CreateBug';
import EditBug from '@/pages/EditBug';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <Router>
            <Routes>
              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>

              {/* Main App Routes */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/new" element={<CreateProject />} />
                <Route path="/projects/:projectId" element={<ProjectDetail />} />
                <Route path="/projects/:projectId/edit" element={<EditProject />} />
                <Route path="/bugs" element={<Bugs />} />
                <Route path="/bugs/new" element={<CreateBug />} />
                <Route path="/bugs/:bugId" element={<BugDetail />} />
                <Route path="/bugs/:bugId/edit" element={<EditBug />} />
                <Route path="/projects/:projectId/bugs/:bugId" element={<BugDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
            </Router>
            <Toaster />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;