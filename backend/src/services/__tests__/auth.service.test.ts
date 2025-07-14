import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../auth.service';
import { AppError } from '../../middleware/errorHandler';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        role: 'REPORTER',
        avatarUrl: null,
        createdAt: new Date(),
      };

      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      const result = await AuthService.register(
        'test@example.com',
        'password123',
        'Test User',
        'testuser'
      );

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: 'test@example.com' },
            { username: 'testuser' }
          ]
        }
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashedPassword',
          fullName: 'Test User',
          username: 'testuser',
          role: 'REPORTER',
        },
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error if email already exists', async () => {
      const existingUser = {
        id: '1',
        email: 'test@example.com',
        username: 'differentuser',
      };

      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(existingUser);

      await expect(
        AuthService.register('test@example.com', 'password', 'Test User', 'testuser')
      ).rejects.toThrow(new AppError('User with this email already exists', 409));
    });

    it('should throw error if username already exists', async () => {
      const existingUser = {
        id: '1',
        email: 'different@example.com',
        username: 'testuser',
      };

      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(existingUser);

      await expect(
        AuthService.register('test@example.com', 'password', 'Test User', 'testuser')
      ).rejects.toThrow(new AppError('Username already taken', 409));
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
        username: 'testuser',
        fullName: 'Test User',
        role: 'REPORTER',
        avatarUrl: null,
        createdAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.login('test@example.com', 'password123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw error with invalid email', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        AuthService.login('invalid@example.com', 'password')
      ).rejects.toThrow(new AppError('Invalid email or password', 401));
    });

    it('should throw error with invalid password', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        AuthService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow(new AppError('Invalid email or password', 401));
    });
  });

  describe('logout', () => {
    it('should successfully logout by deleting refresh token', async () => {
      (mockPrisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await AuthService.logout('refresh-token');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'refresh-token' }
      });
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens with valid refresh token', async () => {
      const mockStoredToken = {
        id: '1',
        token: 'refresh-token',
        expiresAt: new Date(Date.now() + 86400000), // 1 day in future
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          fullName: 'Test User',
          role: 'REPORTER',
          passwordHash: 'hashedPassword',
        },
      };

      (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockStoredToken);
      (jwt.verify as jest.Mock).mockReturnValue({ userId: '1', email: 'test@example.com' });
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      (mockPrisma.refreshToken.update as jest.Mock).mockResolvedValue({});

      const result = await AuthService.refreshTokens('refresh-token');

      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: 'refresh-token' },
        include: { user: true }
      });
      expect(jwt.verify).toHaveBeenCalledWith('refresh-token', 'test-refresh-secret');
      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw error with invalid refresh token', async () => {
      (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        AuthService.refreshTokens('invalid-token')
      ).rejects.toThrow(new AppError('Invalid or expired refresh token', 401));
    });

    it('should throw error with expired refresh token', async () => {
      const mockStoredToken = {
        id: '1',
        token: 'refresh-token',
        expiresAt: new Date(Date.now() - 86400000), // 1 day in past
        user: { id: '1', email: 'test@example.com' },
      };

      (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockStoredToken);

      await expect(
        AuthService.refreshTokens('refresh-token')
      ).rejects.toThrow(new AppError('Invalid or expired refresh token', 401));
    });
  });

  describe('resetPasswordRequest', () => {
    it('should create password reset request for existing user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue('reset-token');
      (mockPrisma.passwordReset.create as jest.Mock).mockResolvedValue({});

      await AuthService.resetPasswordRequest('test@example.com');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
      expect(mockPrisma.passwordReset.create).toHaveBeenCalled();
    });

    it('should not throw error for non-existing user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        AuthService.resetPasswordRequest('nonexisting@example.com')
      ).resolves.not.toThrow();

      expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      const mockResetRequest = {
        id: '1',
        token: 'reset-token',
        userId: '1',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour in future
        used: false,
      };

      (mockPrisma.passwordReset.findUnique as jest.Mock).mockResolvedValue(mockResetRequest);
      (jwt.verify as jest.Mock).mockReturnValue({ userId: '1', email: 'test@example.com', type: 'reset' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

      await AuthService.resetPassword('reset-token', 'newpassword');

      expect(mockPrisma.passwordReset.findUnique).toHaveBeenCalledWith({
        where: { token: 'reset-token' }
      });
      expect(jwt.verify).toHaveBeenCalledWith('reset-token', 'test-secret');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error with invalid token', async () => {
      (mockPrisma.passwordReset.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        AuthService.resetPassword('invalid-token', 'newpassword')
      ).rejects.toThrow(new AppError('Invalid or expired reset token', 400));
    });

    it('should throw error with expired token', async () => {
      const mockResetRequest = {
        id: '1',
        token: 'reset-token',
        userId: '1',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour in past
        used: false,
      };

      (mockPrisma.passwordReset.findUnique as jest.Mock).mockResolvedValue(mockResetRequest);

      await expect(
        AuthService.resetPassword('reset-token', 'newpassword')
      ).rejects.toThrow(new AppError('Invalid or expired reset token', 400));
    });

    it('should throw error with used token', async () => {
      const mockResetRequest = {
        id: '1',
        token: 'reset-token',
        userId: '1',
        expiresAt: new Date(Date.now() + 3600000),
        used: true,
      };

      (mockPrisma.passwordReset.findUnique as jest.Mock).mockResolvedValue(mockResetRequest);

      await expect(
        AuthService.resetPassword('reset-token', 'newpassword')
      ).rejects.toThrow(new AppError('Invalid or expired reset token', 400));
    });
  });
});