import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService } from '../../services/auth.service';
import { AppError } from '../../middleware/errorHandler';

// Mock AuthService
jest.mock('../../services/auth.service');
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('AuthController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      body: {},
      cookies: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  describe('register', () => {
    const mockUserData = {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
      username: 'testuser'
    };

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      role: 'REPORTER'
    };

    it('should successfully register a user', async () => {
      mockRequest.body = mockUserData;
      mockAuthService.register.mockResolvedValue(mockUser as any);

      await AuthController.register(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.register).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'Test User',
        'testuser'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { user: mockUser }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw error if required fields are missing', async () => {
      mockRequest.body = { email: 'test@example.com' }; // Missing other fields

      await AuthController.register(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Email, password, full name, and username are required',
          statusCode: 400
        })
      );
    });

    it('should call next with error if service throws', async () => {
      mockRequest.body = mockUserData;
      const serviceError = new AppError('User already exists', 409);
      mockAuthService.register.mockRejectedValue(serviceError);

      await AuthController.register(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('login', () => {
    const mockLoginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const mockLoginResponse = {
      user: { id: 'user-1', email: 'test@example.com' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    };

    it('should successfully login a user', async () => {
      mockRequest.body = mockLoginData;
      mockAuthService.login.mockResolvedValue(mockLoginResponse as any);

      await AuthController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockResponse.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-token', {
        httpOnly: true,
        secure: false, // NODE_ENV is not production in tests
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: mockLoginResponse.user,
          accessToken: 'access-token'
        }
      });
    });

    it('should throw error if email or password missing', async () => {
      mockRequest.body = { email: 'test@example.com' }; // Missing password

      await AuthController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Email and password are required',
          statusCode: 400
        })
      );
    });

    it('should call next with error if service throws', async () => {
      mockRequest.body = mockLoginData;
      const serviceError = new AppError('Invalid credentials', 401);
      mockAuthService.login.mockRejectedValue(serviceError);

      await AuthController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('logout', () => {
    it('should successfully logout with refresh token', async () => {
      mockRequest.cookies = { refreshToken: 'refresh-token' };
      mockAuthService.logout.mockResolvedValue();

      await AuthController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should successfully logout without refresh token', async () => {
      mockRequest.cookies = {};

      await AuthController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should call next with error if service throws', async () => {
      mockRequest.cookies = { refreshToken: 'refresh-token' };
      const serviceError = new Error('Database error');
      mockAuthService.logout.mockRejectedValue(serviceError);

      await AuthController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('refreshToken', () => {
    const mockRefreshResponse = {
      user: { id: 'user-1', email: 'test@example.com' },
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    };

    it('should successfully refresh tokens', async () => {
      mockRequest.cookies = { refreshToken: 'old-refresh-token' };
      mockAuthService.refreshTokens.mockResolvedValue(mockRefreshResponse as any);

      await AuthController.refreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('old-refresh-token');
      expect(mockResponse.cookie).toHaveBeenCalledWith('refreshToken', 'new-refresh-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: mockRefreshResponse.user,
          accessToken: 'new-access-token'
        }
      });
    });

    it('should throw error if refresh token not provided', async () => {
      mockRequest.cookies = {};

      await AuthController.refreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Refresh token not provided',
          statusCode: 401
        })
      );
    });

    it('should call next with error if service throws', async () => {
      mockRequest.cookies = { refreshToken: 'invalid-token' };
      const serviceError = new AppError('Invalid refresh token', 401);
      mockAuthService.refreshTokens.mockRejectedValue(serviceError);

      await AuthController.refreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('resetPasswordRequest', () => {
    it('should successfully send reset password request', async () => {
      mockRequest.body = { email: 'test@example.com' };
      mockAuthService.resetPasswordRequest.mockResolvedValue();

      await AuthController.resetPasswordRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.resetPasswordRequest).toHaveBeenCalledWith('test@example.com');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    });

    it('should throw error if email not provided', async () => {
      mockRequest.body = {};

      await AuthController.resetPasswordRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Email is required',
          statusCode: 400
        })
      );
    });

    it('should call next with error if service throws', async () => {
      mockRequest.body = { email: 'test@example.com' };
      const serviceError = new Error('Database error');
      mockAuthService.resetPasswordRequest.mockRejectedValue(serviceError);

      await AuthController.resetPasswordRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password', async () => {
      mockRequest.body = { token: 'reset-token', password: 'newpassword' };
      mockAuthService.resetPassword.mockResolvedValue();

      await AuthController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('reset-token', 'newpassword');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });

    it('should throw error if token or password not provided', async () => {
      mockRequest.body = { token: 'reset-token' }; // Missing password

      await AuthController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Token and password are required',
          statusCode: 400
        })
      );
    });

    it('should call next with error if service throws', async () => {
      mockRequest.body = { token: 'invalid-token', password: 'newpassword' };
      const serviceError = new AppError('Invalid reset token', 400);
      mockAuthService.resetPassword.mockRejectedValue(serviceError);

      await AuthController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });
});