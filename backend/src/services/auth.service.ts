import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

interface TokenPayload {
  userId: string;
  email: string;
}

interface LoginResponse {
  user: Partial<User>;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  static async register(
    email: string,
    password: string,
    fullName: string,
    username: string
  ): Promise<Partial<User>> {
    const existingUser = await prisma.user.findFirst({ 
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        throw new AppError('User with this email already exists', 409);
      }
      throw new AppError('Username already taken', 409);
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName,
        username,
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

    return user;
  }

  static async login(email: string, password: string): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('Invalid email or password', 401);
    }

    const accessToken = this.generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = this.generateRefreshToken({ userId: user.id, email: user.email });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  static async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  static async refreshTokens(refreshToken: string): Promise<LoginResponse> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    try {
      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const newAccessToken = this.generateAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
    });

    const newRefreshToken = this.generateRefreshToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
    });

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = storedToken.user;

    return {
      user: userWithoutPassword,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async resetPasswordRequest(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    await prisma.passwordReset.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // TODO: Send email with reset token
    console.log('Password reset token:', resetToken);
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetRequest = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRequest || resetRequest.expiresAt < new Date() || resetRequest.used) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (decoded.type !== 'reset') {
        throw new AppError('Invalid token type', 400);
      }

      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetRequest.userId },
          data: { passwordHash: hashedPassword },
        }),
        prisma.passwordReset.update({
          where: { id: resetRequest.id },
          data: { used: true },
        }),
      ]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid reset token', 400);
    }
  }

  private static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });
  }

  private static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });
  }
}