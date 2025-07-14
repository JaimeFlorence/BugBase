import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bug } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    username: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      await register({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        username: formData.username,
      });
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center mb-4">
          <Bug className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="text-muted-foreground">
          Enter your information to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            placeholder="John Doe"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="johndoe"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            disabled={isLoading}
          />
          {errors.username && (
            <p className="text-sm text-destructive">{errors.username}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}