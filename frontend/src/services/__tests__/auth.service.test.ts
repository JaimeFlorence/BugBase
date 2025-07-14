import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock axios before importing the auth service
vi.mock('axios', () => {
  const mockApiInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockApiInstance),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  };
});

import axios from 'axios';
import { authService } from '../auth.service';

const mockedAxios = axios as any;
// Get the mocked api instance that was created
const mockApiInstance = mockedAxios.create();

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

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await authService.login('test@example.com', 'password');

      expect(mockApiInstance.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle login errors', async () => {
      const mockError = new Error('Invalid credentials');
      mockApiInstance.post.mockRejectedValue(mockError);

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

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await authService.register(registrationData);

      expect(mockApiInstance.post).toHaveBeenCalledWith('/auth/register', registrationData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle registration errors', async () => {
      const mockError = new Error('Email already exists');
      mockApiInstance.post.mockRejectedValue(mockError);

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

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await authService.logout();

      expect(mockApiInstance.post).toHaveBeenCalledWith('/auth/logout');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle logout errors', async () => {
      const mockError = new Error('Logout failed');
      mockApiInstance.post.mockRejectedValue(mockError);

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

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshToken();

      expect(mockApiInstance.post).toHaveBeenCalledWith('/auth/refresh');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle refresh token errors', async () => {
      const mockError = new Error('Invalid refresh token');
      mockApiInstance.post.mockRejectedValue(mockError);

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

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await authService.resetPasswordRequest('test@example.com');

      expect(mockApiInstance.post).toHaveBeenCalledWith('/auth/reset-password-request', {
        email: 'test@example.com'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle reset password request errors', async () => {
      const mockError = new Error('Email not found');
      mockApiInstance.post.mockRejectedValue(mockError);

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

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await authService.resetPassword('reset-token', 'newpassword');

      expect(mockApiInstance.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'reset-token',
        password: 'newpassword'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle reset password errors', async () => {
      const mockError = new Error('Invalid reset token');
      mockApiInstance.post.mockRejectedValue(mockError);

      await expect(authService.resetPassword('invalid-token', 'newpassword'))
        .rejects.toThrow('Invalid reset token');
    });
  });
});