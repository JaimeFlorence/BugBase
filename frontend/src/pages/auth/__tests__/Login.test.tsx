import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from '../Login';

// Mock the dependencies
const mockLogin = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin
  })
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, ...props }: any) => (
    <button disabled={disabled} {...props}>{children}</button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}));

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial rendering', () => {
    it('should render login form with all elements', () => {
      renderLogin();

      // Header elements
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
      expect(screen.getByText('Enter your email to sign in to your account')).toBeInTheDocument();

      // Form fields
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();

      // Submit button
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

      // Links
      expect(screen.getByText('Sign up')).toBeInTheDocument();
      expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    });

    it('should render email input with correct attributes', () => {
      renderLogin();

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('placeholder', 'name@example.com');
      expect(emailInput).toBeRequired();
    });

    it('should render password input with correct attributes', () => {
      renderLogin();

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toBeRequired();
    });

    it('should render Bug icon', () => {
      const { container } = renderLogin();

      const icon = container.querySelector('.lucide-bug');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-12', 'w-12', 'text-primary');
    });
  });

  describe('Form interaction', () => {
    it('should update email field when user types', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText('Email');
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should update password field when user types', async () => {
      const user = userEvent.setup();
      renderLogin();

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    it('should call login function with form data on submit', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should prevent form submission when fields are empty', async () => {
      renderLogin();

      // HTML5 validation prevents submission in the browser, but not in tests
      // This test verifies the form has required attributes
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      
      expect(emailInput).toBeRequired();
      expect(passwordInput).toBeRequired();
    });
  });

  describe('Loading state', () => {
    it('should disable inputs and show loading text during submission', async () => {
      const user = userEvent.setup();
      mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderLogin();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeInTheDocument();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      });

      expect(emailInput).not.toBeDisabled();
      expect(passwordInput).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
    });

    it('should re-enable form after login error', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      renderLogin();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(emailInput).not.toBeDisabled();
        expect(passwordInput).not.toBeDisabled();
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Navigation links', () => {
    it('should have correct link to register page', () => {
      renderLogin();

      const registerLink = screen.getByText('Sign up');
      expect(registerLink).toHaveAttribute('href', '/register');
      expect(registerLink).toHaveClass('text-primary', 'hover:underline');
    });

    it('should have correct link to forgot password page', () => {
      renderLogin();

      const forgotPasswordLink = screen.getByText('Forgot password?');
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
      expect(forgotPasswordLink).toHaveClass('text-muted-foreground', 'hover:text-primary');
    });
  });

  describe('Form submission edge cases', () => {
    it('should handle successful login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(undefined);

      renderLogin();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('should have required validation on all fields', async () => {
      renderLogin();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      // Verify both fields are required
      expect(emailInput).toBeRequired();
      expect(passwordInput).toBeRequired();
      
      // Verify email field has email type
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });

  describe('Styling and layout', () => {
    it('should have correct layout structure', () => {
      const { container } = renderLogin();

      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass('space-y-6');

      const form = container.querySelector('form');
      expect(form).toHaveClass('space-y-4');
    });

    it('should have full width submit button', () => {
      renderLogin();

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      expect(submitButton).toHaveClass('w-full');
    });

    it('should have centered text elements', () => {
      const { container } = renderLogin();

      const centerElements = container.querySelectorAll('.text-center');
      expect(centerElements.length).toBeGreaterThan(0);
    });
  });
});