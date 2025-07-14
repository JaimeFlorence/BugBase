import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';

// Security middleware imports
import { securityHeaders, securityHeadersPresets } from './middleware/security-headers.middleware';
import { xssProtection, outputEncoding, contentTypeValidation } from './middleware/xss-protection.middleware';
import { csrf, csrfDoubleSubmit, apiCSRF } from './middleware/csrf.middleware';
import { rateLimiters, IPBlocker } from './middleware/rate-limit.middleware';
import { validate, sanitizeInput } from './middleware/validation.middleware';
import { errorHandler } from './middleware/errorHandler';
import { initializeCache } from './config/cache.config';
import { AuthSecurityService } from './services/auth-security.service';

// Initialize security services
const ipBlocker = new IPBlocker();

export async function setupSecurity(app: Application) {
  // Trust proxy (important for accurate IP addresses)
  app.set('trust proxy', 1);

  // Basic security with Helmet (redundant with our custom headers but good as fallback)
  app.use(helmet({
    contentSecurityPolicy: false, // We use our custom CSP
  }));

  // Compression
  app.use(compression());

  // CORS configuration
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
      
      // Allow requests with no origin (mobile apps, Postman, etc)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  };
  
  app.use(cors(corsOptions));

  // Cookie parser for CSRF tokens
  app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie-secret'));

  // Body parsing with size limits
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      // Store raw body for webhook signature verification
      (req as any).rawBody = buf.toString('utf8');
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security headers based on environment
  if (process.env.NODE_ENV === 'production') {
    app.use(securityHeaders({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts with nonce
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }));
  } else {
    app.use(securityHeadersPresets.development);
  }

  // XSS Protection
  app.use(xssProtection({
    mode: 'strict',
    enableLogging: process.env.NODE_ENV !== 'production',
    skipPaths: ['/api/webhooks'], // Skip for webhook endpoints
  }));

  // Output encoding
  app.use(outputEncoding);

  // Content-Type validation
  app.use(contentTypeValidation(['application/json', 'multipart/form-data']));

  // IP blocking for suspicious activity
  app.use(ipBlocker.middleware());

  // Global rate limiting
  app.use(rateLimiters.api);

  // CSRF Protection for API routes
  app.use('/api', apiCSRF);

  // Initialize cache
  await initializeCache();

  // Schedule cleanup tasks
  setInterval(() => {
    AuthSecurityService.cleanup().catch(console.error);
  }, 60 * 60 * 1000); // Every hour

  return {
    ipBlocker,
    rateLimiters,
  };
}

// Security middleware for specific route groups
export const authSecurityMiddleware = [
  rateLimiters.auth,
  validate, // Will be configured per route
];

export const apiSecurityMiddleware = [
  rateLimiters.api,
  validate, // Will be configured per route
];

export const uploadSecurityMiddleware = [
  rateLimiters.upload,
  // File upload specific validation will be added
];

// Example usage in routes
export function secureAuthRoutes(router: express.Router) {
  // Login endpoint with strict rate limiting and validation
  router.post('/login',
    rateLimiters.auth,
    validate({
      body: authSchemas.login,
    }),
    async (req, res, next) => {
      try {
        const { email, password } = req.body;
        const ip = req.ip;
        const userAgent = req.get('user-agent') || '';

        // Check account lockout
        const lockout = await AuthSecurityService.checkAccountLockout(email);
        if (lockout.isLocked) {
          return res.status(429).json({
            success: false,
            error: 'Account temporarily locked',
            retryAfter: lockout.remainingTime,
          });
        }

        // Authenticate user
        const result = await authenticateUser(email, password);
        
        // Record attempt
        AuthSecurityService.recordLoginAttempt(
          email,
          result.success,
          ip,
          userAgent
        );

        if (!result.success) {
          return res.status(401).json({
            success: false,
            error: 'Invalid credentials',
          });
        }

        // Check for suspicious login
        const suspicious = await AuthSecurityService.checkSuspiciousLogin(
          result.userId,
          ip,
          userAgent
        );

        if (suspicious.suspicious) {
          // Send security alert email
          await sendSecurityAlert(result.userId, suspicious.reason);
          
          // Optionally require additional verification
        }

        // Create session
        const session = await AuthSecurityService.createSession(
          result.userId,
          ip,
          userAgent
        );

        res.json({
          success: true,
          data: session,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Password reset with validation
  router.post('/reset-password',
    rateLimiters.auth,
    validate({
      body: authSchemas.resetPassword,
    }),
    async (req, res, next) => {
      try {
        const { token, password } = req.body;

        // Check password strength
        const strength = AuthSecurityService.checkPasswordStrength(password);
        if (!strength.isStrong) {
          return res.status(400).json({
            success: false,
            error: 'Password not strong enough',
            feedback: strength.feedback,
          });
        }

        // Verify token
        const verification = await AuthSecurityService.verifyPasswordResetToken(token);
        if (!verification.valid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid or expired token',
          });
        }

        // Update password
        const hashedPassword = await AuthSecurityService.hashPassword(password);
        await updateUserPassword(verification.userId!, hashedPassword);

        // Log security event
        await AuthSecurityService.logSecurityEvent(
          verification.userId!,
          'password_reset',
          {
            ip: req.ip,
            userAgent: req.get('user-agent'),
          }
        );

        res.json({
          success: true,
          message: 'Password reset successful',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

// Helper functions (implement these based on your application)
async function authenticateUser(email: string, password: string): Promise<{
  success: boolean;
  userId?: string;
}> {
  // Implementation here
  return { success: false };
}

async function sendSecurityAlert(userId: string, reason: string): Promise<void> {
  // Implementation here
}

async function updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
  // Implementation here
}

// Import validation schemas
import { authSchemas } from './middleware/validation.middleware';