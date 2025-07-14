import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface SecurityHeadersOptions {
  contentSecurityPolicy?: ContentSecurityPolicyOptions | false;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  expectCt?: ExpectCtOptions | false;
  referrerPolicy?: ReferrerPolicyOptions | false;
  hsts?: HstsOptions | false;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  dnsPrefetchControl?: boolean;
  frameGuard?: FrameGuardOptions | false;
  permittedCrossDomainPolicies?: PermittedCrossDomainPoliciesOptions | false;
  ieNoOpen?: boolean;
  xssFilter?: boolean;
}

interface ContentSecurityPolicyOptions {
  useDefaults?: boolean;
  directives?: Record<string, string[] | string | boolean>;
  reportOnly?: boolean;
}

interface ExpectCtOptions {
  maxAge?: number;
  enforce?: boolean;
  reportUri?: string;
}

interface ReferrerPolicyOptions {
  policy?: string | string[];
}

interface HstsOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

interface FrameGuardOptions {
  action?: 'deny' | 'sameorigin';
}

interface PermittedCrossDomainPoliciesOptions {
  permittedPolicies?: 'none' | 'master-only' | 'by-content-type' | 'all';
}

// Default CSP directives for a secure application
const defaultCspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  fontSrc: ["'self'", 'https:', 'data:'],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'none'"],
  styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
  connectSrc: ["'self'", 'wss:', 'https:'],
  upgradeInsecureRequests: [],
};

export function securityHeaders(options: SecurityHeadersOptions = {}) {
  // Set defaults
  const config = {
    contentSecurityPolicy: options.contentSecurityPolicy !== false 
      ? { useDefaults: true, ...options.contentSecurityPolicy } 
      : false,
    crossOriginEmbedderPolicy: options.crossOriginEmbedderPolicy ?? true,
    crossOriginOpenerPolicy: options.crossOriginOpenerPolicy ?? true,
    crossOriginResourcePolicy: options.crossOriginResourcePolicy ?? true,
    expectCt: options.expectCt !== false 
      ? { maxAge: 86400, enforce: true, ...options.expectCt } 
      : false,
    referrerPolicy: options.referrerPolicy !== false 
      ? { policy: 'strict-origin-when-cross-origin', ...options.referrerPolicy } 
      : false,
    hsts: options.hsts !== false 
      ? { maxAge: 31536000, includeSubDomains: true, preload: true, ...options.hsts } 
      : false,
    noSniff: options.noSniff ?? true,
    originAgentCluster: options.originAgentCluster ?? true,
    dnsPrefetchControl: options.dnsPrefetchControl ?? true,
    frameGuard: options.frameGuard !== false 
      ? { action: 'deny' as const, ...options.frameGuard } 
      : false,
    permittedCrossDomainPolicies: options.permittedCrossDomainPolicies !== false 
      ? { permittedPolicies: 'none' as const, ...options.permittedCrossDomainPolicies } 
      : false,
    ieNoOpen: options.ieNoOpen ?? true,
    xssFilter: options.xssFilter ?? true,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    if (config.contentSecurityPolicy) {
      const cspOptions = config.contentSecurityPolicy as ContentSecurityPolicyOptions;
      const directives = cspOptions.useDefaults 
        ? { ...defaultCspDirectives, ...cspOptions.directives } 
        : cspOptions.directives || {};

      // Generate nonce for inline scripts if needed
      const nonce = crypto.randomBytes(16).toString('base64');
      res.locals.cspNonce = nonce;

      // Add nonce to script-src if it exists
      if (directives.scriptSrc && Array.isArray(directives.scriptSrc)) {
        directives.scriptSrc = [...directives.scriptSrc, `'nonce-${nonce}'`];
      }

      const cspString = Object.entries(directives)
        .map(([key, values]) => {
          const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          if (Array.isArray(values)) {
            return values.length > 0 ? `${directive} ${values.join(' ')}` : directive;
          }
          return `${directive} ${values}`;
        })
        .join('; ');

      const headerName = cspOptions.reportOnly 
        ? 'Content-Security-Policy-Report-Only' 
        : 'Content-Security-Policy';
      
      res.setHeader(headerName, cspString);
    }

    // Cross-Origin-Embedder-Policy
    if (config.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross-Origin-Opener-Policy
    if (config.crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Cross-Origin-Resource-Policy
    if (config.crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }

    // Expect-CT
    if (config.expectCt) {
      const expectCtOptions = config.expectCt as ExpectCtOptions;
      let headerValue = `max-age=${expectCtOptions.maxAge}`;
      if (expectCtOptions.enforce) {
        headerValue += ', enforce';
      }
      if (expectCtOptions.reportUri) {
        headerValue += `, report-uri="${expectCtOptions.reportUri}"`;
      }
      res.setHeader('Expect-CT', headerValue);
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      const referrerOptions = config.referrerPolicy as ReferrerPolicyOptions;
      const policy = Array.isArray(referrerOptions.policy) 
        ? referrerOptions.policy.join(', ') 
        : referrerOptions.policy;
      res.setHeader('Referrer-Policy', policy || 'strict-origin-when-cross-origin');
    }

    // Strict-Transport-Security (HSTS)
    if (config.hsts && (req.secure || req.header('x-forwarded-proto') === 'https')) {
      const hstsOptions = config.hsts as HstsOptions;
      let headerValue = `max-age=${hstsOptions.maxAge}`;
      if (hstsOptions.includeSubDomains) {
        headerValue += '; includeSubDomains';
      }
      if (hstsOptions.preload) {
        headerValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', headerValue);
    }

    // X-Content-Type-Options
    if (config.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Origin-Agent-Cluster
    if (config.originAgentCluster) {
      res.setHeader('Origin-Agent-Cluster', '?1');
    }

    // X-DNS-Prefetch-Control
    if (config.dnsPrefetchControl) {
      res.setHeader('X-DNS-Prefetch-Control', 'off');
    }

    // X-Frame-Options
    if (config.frameGuard) {
      const frameOptions = config.frameGuard as FrameGuardOptions;
      res.setHeader('X-Frame-Options', frameOptions.action?.toUpperCase() || 'DENY');
    }

    // X-Permitted-Cross-Domain-Policies
    if (config.permittedCrossDomainPolicies) {
      const pcdpOptions = config.permittedCrossDomainPolicies as PermittedCrossDomainPoliciesOptions;
      res.setHeader('X-Permitted-Cross-Domain-Policies', pcdpOptions.permittedPolicies || 'none');
    }

    // X-Download-Options (IE8+)
    if (config.ieNoOpen) {
      res.setHeader('X-Download-Options', 'noopen');
    }

    // X-XSS-Protection (legacy, but still useful for older browsers)
    if (config.xssFilter) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Additional security headers
    res.setHeader('X-Powered-By', 'BugBase'); // Hide Express
    res.setHeader('X-Content-Security-Policy', 'default-src \'self\''); // IE fallback
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  };
}

// Preset configurations
export const securityHeadersPresets = {
  // Maximum security (may break some functionality)
  strict: securityHeaders({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  }),

  // Balanced security for API servers
  api: securityHeaders({
    contentSecurityPolicy: false, // APIs don't serve HTML
    crossOriginResourcePolicy: false, // Allow cross-origin requests
    frameGuard: false, // APIs don't render in frames
  }),

  // Development environment
  development: securityHeaders({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow HMR
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
      },
    },
    hsts: false, // Don't force HTTPS in development
  }),
};

// Helper to generate CSP hash for inline scripts/styles
export function generateCSPHash(content: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): string {
  const hash = crypto.createHash(algorithm);
  hash.update(content);
  return `'${algorithm}-${hash.digest('base64')}'`;
}