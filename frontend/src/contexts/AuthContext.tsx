import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { toast } from '@/components/ui/toaster';

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  username: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    refreshAuth();
  }, []);

  const refreshAuth = async () => {
    try {
      setIsLoading(true);
      const accessToken = localStorage.getItem('accessToken');
      
      if (!accessToken) {
        setUser(null);
        return;
      }

      const response = await authService.refreshToken();
      if (response.data) {
        setUser(response.data.user);
        localStorage.setItem('accessToken', response.data.accessToken);
      }
    } catch (error) {
      localStorage.removeItem('accessToken');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      setUser(response.data.user);
      localStorage.setItem('accessToken', response.data.accessToken);
      toast({ title: 'Welcome back!', type: 'success' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.response?.data?.error?.message || 'Invalid credentials',
        type: 'error',
      });
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      await authService.register(data);
      toast({
        title: 'Registration successful!',
        description: 'Please log in with your new account.',
        type: 'success',
      });
      navigate('/login');
    } catch (error: any) {
      toast({
        title: 'Registration failed',
        description: error.response?.data?.error?.message || 'Something went wrong',
        type: 'error',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('accessToken');
      navigate('/login');
      toast({ title: 'Logged out successfully', type: 'success' });
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}