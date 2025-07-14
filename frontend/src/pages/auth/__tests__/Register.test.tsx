import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Register from '../Register';

// Mock the dependencies
const mockRegister = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister
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

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );
};

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial rendering', () => {
    it('should render registration form with all elements', () => {
      renderRegister();

      // Header elements
      expect(screen.getByText('Create an account')).toBeInTheDocument();
      expect(screen.getByText('Enter your information to get started')).toBeInTheDocument();

      // Form fields
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();

      // Submit button
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();

      // Link to login
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });

    it('should render input fields with correct attributes', () => {
      renderRegister();

      const fullNameInput = screen.getByLabelText('Full Name');
      expect(fullNameInput).toHaveAttribute('placeholder', 'John Doe');
      expect(fullNameInput).toBeRequired();

      const usernameInput = screen.getByLabelText('Username');
      expect(usernameInput).toHaveAttribute('placeholder', 'johndoe');
      expect(usernameInput).toBeRequired();

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('placeholder', 'name@example.com');
      expect(emailInput).toBeRequired();

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toBeRequired();

      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toBeRequired();
    });
  });

  describe('Form interaction', () => {
    it('should update form fields when user types', async () => {
      const user = userEvent.setup();
      renderRegister();

      const fullNameInput = screen.getByLabelText('Full Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');

      await user.type(fullNameInput, 'John Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      expect(fullNameInput).toHaveValue('John Doe');
      expect(usernameInput).toHaveValue('johndoe');
      expect(emailInput).toHaveValue('john@example.com');
      expect(passwordInput).toHaveValue('password123');
      expect(confirmPasswordInput).toHaveValue('password123');
    });

    it('should call register function with correct data on valid form submission', async () => {
      const user = userEvent.setup();
      renderRegister();

      await user.type(screen.getByLabelText('Full Name'), 'John Doe');
      await user.type(screen.getByLabelText('Username'), 'johndoe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'password123',
          fullName: 'John Doe',
          username: 'johndoe'
        });
      });
    });
  });

  describe('Form validation', () => {
    it('should show error when password is less than 8 characters', async () => {
      const user = userEvent.setup();
      renderRegister();

      await user.type(screen.getByLabelText('Full Name'), 'John Doe');
      await user.type(screen.getByLabelText('Username'), 'johndoe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.type(screen.getByLabelText('Confirm Password'), 'short');

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup();
      renderRegister();

      await user.type(screen.getByLabelText('Full Name'), 'John Doe');
      await user.type(screen.getByLabelText('Username'), 'johndoe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password456');

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should show error for invalid username format', async () => {
      const user = userEvent.setup();
      renderRegister();

      await user.type(screen.getByLabelText('Full Name'), 'John Doe');
      await user.type(screen.getByLabelText('Username'), 'john-doe!');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should show multiple validation errors', async () => {
      const user = userEvent.setup();
      renderRegister();

      await user.type(screen.getByLabelText('Full Name'), 'John Doe');
      await user.type(screen.getByLabelText('Username'), 'john@doe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.type(screen.getByLabelText('Confirm Password'), 'different');

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should accept valid username formats', async () => {
      const user = userEvent.setup();

      // Test various valid username formats
      const validUsernames = ['johndoe', 'john_doe', 'john123', 'JOHN', 'j', '123'];

      for (const username of validUsernames) {
        // Clear mocks for each iteration
        mockRegister.mockClear();
        
        const { unmount } = renderRegister();

        await user.type(screen.getByLabelText('Full Name'), 'John Doe');
        await user.type(screen.getByLabelText('Username'), username);
        await user.type(screen.getByLabelText('Email'), 'john@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.type(screen.getByLabelText('Confirm Password'), 'password123');

        await user.click(screen.getByRole('button', { name: 'Create account' }));

        // Should not show username error
        expect(screen.queryByText('Username can only contain letters, numbers, and underscores')).not.toBeInTheDocument();
        
        // Should have called register since validation passed
        await waitFor(() => {
          expect(mockRegister).toHaveBeenCalled();
        });

        unmount();
      }
    });
  });

  describe('Loading state', () => {
    it('should disable inputs and show loading text during submission', async () => {
      const user = userEvent.setup();
      mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderRegister();

      const fullNameInput = screen.getByLabelText('Full Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      await user.type(fullNameInput, 'John Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument();
      expect(fullNameInput).toBeDisabled();
      expect(usernameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
      });

      expect(fullNameInput).not.toBeDisabled();
    });

    it('should re-enable form after registration error', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Registration failed'));

      renderRegister();

      await user.type(screen.getByLabelText('Full Name'), 'John Doe');
      await user.type(screen.getByLabelText('Username'), 'johndoe');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name')).not.toBeDisabled();
        expect(screen.getByRole('button', { name: 'Create account' })).not.toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('should have correct link to login page', () => {
      renderRegister();

      const loginLink = screen.getByText('Sign in');
      expect(loginLink).toHaveAttribute('href', '/login');
      expect(loginLink).toHaveClass('text-primary', 'hover:underline');
    });
  });

  describe('Styling and layout', () => {
    it('should have correct layout structure', () => {
      const { container } = renderRegister();

      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass('space-y-6');

      const form = container.querySelector('form');
      expect(form).toHaveClass('space-y-4');
    });

    it('should have full width submit button', () => {
      renderRegister();

      const submitButton = screen.getByRole('button', { name: 'Create account' });
      expect(submitButton).toHaveClass('w-full');
    });

    it('should style error messages correctly', async () => {
      const user = userEvent.setup();
      renderRegister();

      // Fill all required fields first
      await user.type(screen.getByLabelText('Full Name'), 'John Doe');
      await user.type(screen.getByLabelText('Username'), 'invalid@username');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.type(screen.getByLabelText('Confirm Password'), 'different');
      
      // Try to submit the form to trigger validation
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      // Wait for error messages to appear
      await waitFor(() => {
        expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });

      // Check styling of all error messages
      const usernameError = screen.getByText('Username can only contain letters, numbers, and underscores');
      const passwordError = screen.getByText('Password must be at least 8 characters');
      const confirmError = screen.getByText('Passwords do not match');
      
      expect(usernameError).toHaveClass('text-sm', 'text-destructive');
      expect(passwordError).toHaveClass('text-sm', 'text-destructive');
      expect(confirmError).toHaveClass('text-sm', 'text-destructive');
    });
  });
});