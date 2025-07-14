import request from 'supertest';
import express from 'express';
import { authRoutes } from '../../routes/auth.routes';
import { errorHandler } from '../../middleware/errorHandler';

// Mock the auth service
jest.mock('../../services/auth.service', () => ({
  AuthService: {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refreshTokens: jest.fn(),
    resetPasswordRequest: jest.fn(),
    resetPassword: jest.fn(),
  }
}));

import { AuthService } from '../../services/auth.service';

describe('Authentication E2E Tests', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  describe('User Registration and Login Flow', () => {
    it('should complete full registration and login flow', async () => {
      const userRegistrationData = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        username: 'testuser'
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        role: 'REPORTER'
      };

      // Step 1: Register
      (AuthService.register as jest.Mock).mockResolvedValue(mockUser);

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userRegistrationData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user).toEqual(mockUser);
      expect(AuthService.register).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'Test User',
        'testuser'
      );

      // Step 2: Login
      const mockLoginResponse = {
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      (AuthService.login as jest.Mock).mockResolvedValue(mockLoginResponse);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.user).toEqual(mockUser);
      expect(loginResponse.body.data.accessToken).toBe('access-token');
      expect(loginResponse.header['set-cookie']).toBeDefined();
      expect(AuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');

      // Step 3: Logout
      (AuthService.logout as jest.Mock).mockResolvedValue(undefined);

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'refreshToken=refresh-token')
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);
      expect(logoutResponse.body.message).toBe('Logged out successfully');
      expect(AuthService.logout).toHaveBeenCalledWith('refresh-token');
    });

    it('should handle registration validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'short',
          fullName: '',
          username: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should handle login with invalid credentials', async () => {
      (AuthService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Token Refresh Flow', () => {
    it('should refresh tokens successfully', async () => {
      const mockRefreshResponse = {
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser'
        },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      (AuthService.refreshTokens as jest.Mock).mockResolvedValue(mockRefreshResponse);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=old-refresh-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe('new-access-token');
      expect(response.header['set-cookie']).toBeDefined();
      expect(AuthService.refreshTokens).toHaveBeenCalledWith('old-refresh-token');
    });

    it('should handle invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Refresh token not provided');
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete password reset flow', async () => {
      // Step 1: Request password reset
      (AuthService.resetPasswordRequest as jest.Mock).mockResolvedValue(undefined);

      const resetRequestResponse = await request(app)
        .post('/api/auth/reset-password-request')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(resetRequestResponse.body.success).toBe(true);
      expect(resetRequestResponse.body.message).toContain('password reset link');
      expect(AuthService.resetPasswordRequest).toHaveBeenCalledWith('test@example.com');

      // Step 2: Reset password with token
      (AuthService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'reset-token',
          password: 'newpassword123'
        })
        .expect(200);

      expect(resetPasswordResponse.body.success).toBe(true);
      expect(resetPasswordResponse.body.message).toBe('Password reset successfully');
      expect(AuthService.resetPassword).toHaveBeenCalledWith('reset-token', 'newpassword123');
    });

    it('should handle invalid reset token', async () => {
      (AuthService.resetPassword as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpassword123'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle missing email in reset request', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password-request')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });
  });

  describe('Input Validation', () => {
    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          fullName: 'Test User',
          username: 'testuser'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });
});