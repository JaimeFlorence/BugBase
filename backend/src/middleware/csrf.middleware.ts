import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from './errorHandler';

interface CSRFOptions {
  cookieName?: string;
  headerName?: string;
  tokenLength?: number;
  ignoreMethods?: string[];
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
}

interface CSRFRequest extends Request {
  csrfToken?: () => string;
}

class CSRFProtection {
  private options: Required<CSRFOptions>;
  private tokens: Map<string, { token: string; expires: number }> = new Map();

  constructor(options: CSRFOptions = {}) {
    this.options = {
      cookieName: options.cookieName || 'XSRF-TOKEN',
      headerName: options.headerName || 'X-XSRF-TOKEN',
      tokenLength: options.tokenLength || 32,
      ignoreMethods: options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'],
      sameSite: options.sameSite || 'strict',
      secure: options.secure ?? (process.env.NODE_ENV === 'production'),
      httpOnly: options.httpOnly ?? false, // False so JavaScript can read it
      maxAge: options.maxAge || 86400000, // 24 hours
    };

    // Clean up expired tokens periodically
    setInterval(() => this.cleanupExpiredTokens(), 3600000); // Every hour
  }

  private generateToken(): string {
    return crypto.randomBytes(this.options.tokenLength).toString('hex');
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [key, value] of this.tokens.entries()) {
      if (value.expires < now) {
        this.tokens.delete(key);
      }
    }
  }

  private getSessionId(req: Request): string {
    // Use session ID if available, otherwise use a combination of IP and user agent
    return (req as any).session?.id || 
           crypto.createHash('sha256')
                 .update(req.ip + req.get('user-agent') || '')
                 .digest('hex');
  }

  middleware() {
    return (req: CSRFRequest, res: Response, next: NextFunction) => {
      // Skip CSRF check for ignored methods
      if (this.options.ignoreMethods.includes(req.method)) {
        // Still generate token for GET requests so forms can use it
        this.ensureToken(req, res);
        return next();
      }

      // Get token from header or body
      const receivedToken = req.get(this.options.headerName) || 
                          req.body?._csrf || 
                          req.query?._csrf;

      // Get expected token
      const sessionId = this.getSessionId(req);
      const storedData = this.tokens.get(sessionId);

      if (!storedData || !receivedToken) {
        return next(new AppError('CSRF token missing', 403));
      }

      if (storedData.expires < Date.now()) {
        this.tokens.delete(sessionId);
        return next(new AppError('CSRF token expired', 403));
      }

      // Constant-time comparison to prevent timing attacks
      if (!this.safeCompare(storedData.token, receivedToken)) {
        return next(new AppError('Invalid CSRF token', 403));
      }

      // Token is valid, continue
      next();
    };
  }

  private ensureToken(req: CSRFRequest, res: Response): void {
    const sessionId = this.getSessionId(req);
    let tokenData = this.tokens.get(sessionId);

    // Generate new token if none exists or expired
    if (!tokenData || tokenData.expires < Date.now()) {
      const token = this.generateToken();
      tokenData = {
        token,
        expires: Date.now() + this.options.maxAge,
      };
      this.tokens.set(sessionId, tokenData);
    }

    // Set cookie with token
    res.cookie(this.options.cookieName, tokenData.token, {
      httpOnly: this.options.httpOnly,
      secure: this.options.secure,
      sameSite: this.options.sameSite,
      maxAge: this.options.maxAge,
    });

    // Add method to request to get token
    req.csrfToken = () => tokenData!.token;
  }

  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  // Double Submit Cookie Pattern Implementation
  static doubleSubmitCookie(options: CSRFOptions = {}) {
    return (req: Request, res: Response, next: NextFunction) => {
      const cookieName = options.cookieName || 'csrf-token';
      const headerName = options.headerName || 'x-csrf-token';

      // Skip for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        // Generate token for GET requests
        if (!req.cookies[cookieName]) {
          const token = crypto.randomBytes(32).toString('hex');
          res.cookie(cookieName, token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          });
        }
        return next();
      }

      // Verify token
      const cookieToken = req.cookies[cookieName];
      const headerToken = req.get(headerName) || req.body?._csrf;

      if (!cookieToken || !headerToken) {
        return next(new AppError('CSRF token missing', 403));
      }

      if (cookieToken !== headerToken) {
        return next(new AppError('CSRF token mismatch', 403));
      }

      next();
    };
  }
}

// Create singleton instance
const csrfProtection = new CSRFProtection();

// Export middleware
export const csrf = csrfProtection.middleware();

// Export factory function for custom configurations
export const createCSRFProtection = (options?: CSRFOptions) => {
  const instance = new CSRFProtection(options);
  return instance.middleware();
};

// Export double submit cookie pattern (simpler alternative)
export const csrfDoubleSubmit = CSRFProtection.doubleSubmitCookie;

// Helper middleware to add CSRF token to response locals (for template rendering)
export const csrfToken = (req: CSRFRequest, res: Response, next: NextFunction) => {
  res.locals.csrfToken = req.csrfToken?.() || '';
  next();
};

// API-specific CSRF protection with custom header
export const apiCSRF = createCSRFProtection({
  headerName: 'X-API-CSRF-TOKEN',
  cookieName: 'api-csrf-token',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  sameSite: 'lax', // Allow for API calls from same site
});

// Form-specific CSRF protection
export const formCSRF = createCSRFProtection({
  headerName: 'X-CSRF-TOKEN',
  cookieName: 'form-csrf-token',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  sameSite: 'strict',
});