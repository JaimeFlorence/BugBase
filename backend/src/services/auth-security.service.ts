import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

interface PasswordStrengthResult {
  score: number; // 0-5
  feedback: string[];
  isStrong: boolean;
}

interface LoginAttempt {
  userId?: string;
  ip: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
}

export class AuthSecurityService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly PASSWORD_MIN_LENGTH = 8;
  private static readonly LOCKOUT_THRESHOLD = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Track login attempts in memory (use Redis in production)
  private static loginAttempts = new Map<string, LoginAttempt[]>();

  // Enhanced password hashing with timing attack protection
  static async hashPassword(password: string): Promise<string> {
    // Add additional entropy to prevent rainbow table attacks
    const pepper = process.env.PASSWORD_PEPPER || 'default-pepper';
    const pepperedPassword = `${password}${pepper}`;
    
    return bcrypt.hash(pepperedPassword, this.SALT_ROUNDS);
  }

  // Secure password comparison with timing attack protection
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const pepper = process.env.PASSWORD_PEPPER || 'default-pepper';
    const pepperedPassword = `${password}${pepper}`;
    
    // Add random delay to prevent timing attacks
    await this.randomDelay();
    
    return bcrypt.compare(pepperedPassword, hash);
  }

  // Password strength checker
  static checkPasswordStrength(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length < 8) feedback.push('Password must be at least 8 characters long');

    // Character variety checks
    if (/[a-z]/.test(password)) score++;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Add uppercase letters');

    if (/[0-9]/.test(password)) score++;
    else feedback.push('Add numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else feedback.push('Add special characters');

    // Common patterns check
    const commonPatterns = [
      /^[0-9]+$/, // All numbers
      /^[a-zA-Z]+$/, // All letters
      /(.)\1{2,}/, // Repeated characters
      /^(?:abc|123|qwerty|password)/i, // Common sequences
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        score = Math.max(0, score - 1);
        feedback.push('Avoid common patterns');
        break;
      }
    }

    // Check against common passwords
    const commonPasswords = [
      'password', '12345678', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];

    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      score = Math.max(0, score - 2);
      feedback.push('This password is too common');
    }

    return {
      score: Math.min(5, score),
      feedback,
      isStrong: score >= 4,
    };
  }

  // Account lockout protection
  static async checkAccountLockout(identifier: string): Promise<{ isLocked: boolean; remainingTime?: number }> {
    const attempts = this.loginAttempts.get(identifier) || [];
    const recentAttempts = attempts.filter(
      attempt => attempt.timestamp.getTime() > Date.now() - this.LOCKOUT_DURATION
    );

    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);

    if (failedAttempts.length >= this.LOCKOUT_THRESHOLD) {
      const oldestAttempt = failedAttempts[0];
      const remainingTime = (oldestAttempt.timestamp.getTime() + this.LOCKOUT_DURATION) - Date.now();
      
      return {
        isLocked: true,
        remainingTime: Math.ceil(remainingTime / 1000), // seconds
      };
    }

    return { isLocked: false };
  }

  // Record login attempt
  static recordLoginAttempt(identifier: string, success: boolean, ip: string, userAgent: string): void {
    const attempts = this.loginAttempts.get(identifier) || [];
    
    attempts.push({
      ip,
      userAgent,
      success,
      timestamp: new Date(),
    });

    // Keep only recent attempts
    const recentAttempts = attempts.filter(
      attempt => attempt.timestamp.getTime() > Date.now() - this.LOCKOUT_DURATION * 2
    );

    this.loginAttempts.set(identifier, recentAttempts);

    // Log suspicious activity
    if (!success) {
      const recentFailures = recentAttempts.filter(a => !a.success).length;
      if (recentFailures >= 3) {
        console.warn(`Multiple failed login attempts for ${identifier} from IP ${ip}`);
      }
    }
  }

  // Generate secure tokens
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate cryptographically secure random string
  static generateSecureRandomString(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.randomBytes(length);
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
    
    return result;
  }

  // Session token generation with fingerprinting
  static generateSessionToken(userId: string, ip: string, userAgent: string): string {
    const payload = {
      userId,
      ip,
      userAgent,
      timestamp: Date.now(),
      nonce: this.generateSecureToken(16),
    };

    const secret = process.env.SESSION_SECRET || 'default-session-secret';
    const token = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return token;
  }

  // Two-factor authentication setup
  static async setupTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const secret = speakeasy.generateSecret({
      name: `BugBase (${user.email})`,
      issuer: 'BugBase',
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  // Verify two-factor authentication token
  static verifyTwoFactorToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step before/after for clock skew
    });
  }

  // Password reset token generation with expiry
  static async generatePasswordResetToken(userId: string): Promise<string> {
    const token = this.generateSecureToken(32);
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
        used: false,
      },
    });

    return token; // Return unhashed token to send to user
  }

  // Verify password reset token
  static async verifyPasswordResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await prisma.passwordReset.findUnique({
      where: { token: hashedToken },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return { valid: false };
    }

    // Mark token as used
    await prisma.passwordReset.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    return { valid: true, userId: resetToken.userId };
  }

  // Secure session management
  static async createSession(userId: string, ip: string, userAgent: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // Generate tokens
    const accessToken = this.generateSecureToken(32);
    const refreshToken = this.generateSecureToken(64);

    // Hash tokens before storing
    const hashedAccessToken = crypto.createHash('sha256').update(accessToken).digest('hex');
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId,
        token: hashedRefreshToken,
        expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY),
      },
    });

    // Log session creation
    await this.logSecurityEvent(userId, 'session_created', { ip, userAgent });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.SESSION_TIMEOUT,
    };
  }

  // Device fingerprinting for additional security
  static generateDeviceFingerprint(req: any): string {
    const components = [
      req.headers['user-agent'],
      req.headers['accept-language'],
      req.headers['accept-encoding'],
      req.ip,
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  // Log security events
  static async logSecurityEvent(userId: string, event: string, metadata: any): Promise<void> {
    // In production, this should be stored in a dedicated security log
    console.log(`[SECURITY] User ${userId}: ${event}`, metadata);

    // Store in database for audit trail
    await prisma.activityLog.create({
      data: {
        userId,
        bugId: metadata.bugId || '', // Required field, use empty string if not applicable
        action: 'UPDATED', // Map security events to existing actions
        metadata: {
          securityEvent: event,
          ...metadata,
        },
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
  }

  // Check for suspicious login patterns
  static async checkSuspiciousLogin(userId: string, ip: string, userAgent: string): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    // Get recent successful logins
    const recentActivity = await prisma.activityLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Check for new location
    const knownIPs = new Set(recentActivity.map(a => a.ipAddress));
    if (!knownIPs.has(ip) && knownIPs.size > 0) {
      return { suspicious: true, reason: 'Login from new location' };
    }

    // Check for new device
    const knownUserAgents = new Set(recentActivity.map(a => a.userAgent));
    if (!knownUserAgents.has(userAgent) && knownUserAgents.size > 0) {
      return { suspicious: true, reason: 'Login from new device' };
    }

    // Check for impossible travel (simplified version)
    // In production, use GeoIP to check actual locations
    const recentLogin = recentActivity[0];
    if (recentLogin && recentLogin.ipAddress !== ip) {
      const timeDiff = Date.now() - recentLogin.createdAt.getTime();
      if (timeDiff < 60 * 60 * 1000) { // Less than 1 hour
        return { suspicious: true, reason: 'Impossible travel detected' };
      }
    }

    return { suspicious: false };
  }

  // Random delay to prevent timing attacks
  private static async randomDelay(): Promise<void> {
    const delay = Math.random() * 100 + 50; // 50-150ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // Cleanup expired tokens and sessions
  static async cleanup(): Promise<void> {
    // Clean expired refresh tokens
    await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    // Clean expired password reset tokens
    await prisma.passwordReset.deleteMany({
      where: {
        OR: [
          { used: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    // Clean old activity logs (keep 90 days)
    await prisma.activityLog.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
    });
  }
}