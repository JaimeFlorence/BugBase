import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, fullName, username } = req.body;

      if (!email || !password || !fullName || !username) {
        throw new AppError('Email, password, full name, and username are required', 400);
      }

      const user = await AuthService.register(email, password, fullName, username);

      res.status(201).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      const { user, accessToken, refreshToken } = await AuthService.login(email, password);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.json({
        success: true,
        data: {
          user,
          accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }

      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        throw new AppError('Refresh token not provided', 401);
      }

      const { user, accessToken, refreshToken: newRefreshToken } = 
        await AuthService.refreshTokens(refreshToken);

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          user,
          accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPasswordRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        throw new AppError('Email is required', 400);
      }

      await AuthService.resetPasswordRequest(email);

      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        throw new AppError('Token and password are required', 400);
      }

      await AuthService.resetPassword(token, password);

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}