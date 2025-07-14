import { vi } from 'vitest';
import axios from 'axios';
import { authService } from '../auth.service';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: { id: '1', email: 'test@example.com' },
            accessToken: 'test-token'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.login('test@example.com', 'password');

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle login errors', async () => {
      const mockError = new Error('Invalid credentials');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(authService.login('invalid@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should register successfully with valid data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: { id: '1', email: 'test@example.com', username: 'testuser' }
          }
        }
      };

      const registrationData = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        username: 'testuser'
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.register(registrationData);

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/register', registrationData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle registration errors', async () => {
      const mockError = new Error('Email already exists');
      mockedAxios.post.mockRejectedValue(mockError);

      const registrationData = {
        email: 'existing@example.com',
        password: 'password123',
        fullName: 'Test User',
        username: 'testuser'
      };

      await expect(authService.register(registrationData))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Logged out successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.logout();

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/logout');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle logout errors', async () => {
      const mockError = new Error('Logout failed');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(authService.logout())
        .rejects.toThrow('Logout failed');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            accessToken: 'new-token'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshToken();

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/refresh');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle refresh token errors', async () => {
      const mockError = new Error('Invalid refresh token');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(authService.refreshToken())
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('resetPasswordRequest', () => {
    it('should send reset password request successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Reset email sent'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.resetPasswordRequest('test@example.com');

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/reset-password-request', {
        email: 'test@example.com'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle reset password request errors', async () => {
      const mockError = new Error('Email not found');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(authService.resetPasswordRequest('invalid@example.com'))
        .rejects.toThrow('Email not found');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Password reset successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.resetPassword('reset-token', 'newpassword');

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'reset-token',
        password: 'newpassword'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle reset password errors', async () => {
      const mockError = new Error('Invalid reset token');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(authService.resetPassword('invalid-token', 'newpassword'))
        .rejects.toThrow('Invalid reset token');
    });
  });
});