import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify with JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Configure DOMPurify for different contexts
const purifyConfigs = {
  // Strict: Remove all HTML
  strict: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  },
  
  // Basic: Allow basic formatting
  basic: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 's', 'p', 'br', 'span'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  },
  
  // Rich: Allow rich text formatting
  rich: {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 's', 'p', 'br', 'span',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'img'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  },
  
  // Markdown: For markdown content
  markdown: {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'strong', 'em', 'u', 's',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'div', 'span'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  },
};

interface XSSProtectionOptions {
  mode?: 'strict' | 'basic' | 'rich' | 'markdown';
  customConfig?: any;
  skipPaths?: string[];
  skipFields?: string[];
  enableLogging?: boolean;
}

export function xssProtection(options: XSSProtectionOptions = {}) {
  const config = {
    mode: options.mode || 'strict',
    customConfig: options.customConfig,
    skipPaths: options.skipPaths || [],
    skipFields: options.skipFields || ['password', 'token', 'secret'],
    enableLogging: options.enableLogging || false,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for certain paths
    if (config.skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip for GET requests (they shouldn't have body)
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, config);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, { ...config, mode: 'strict' }); // Always strict for query params
    }

    // Override res.json to sanitize output
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // Sanitize response data for extra protection
      if (data && typeof data === 'object') {
        data = sanitizeObject(data, config, true);
      }
      return originalJson(data);
    };

    next();
  };
}

function sanitizeObject(obj: any, config: any, isOutput = false): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj, config);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, config, isOutput));
  }

  if (obj && typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof RegExp)) {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip certain fields
      if (config.skipFields.includes(key)) {
        sanitized[key] = value;
        continue;
      }

      // Sanitize the key itself
      const sanitizedKey = sanitizeString(key, { ...config, mode: 'strict' });
      
      // Recursively sanitize the value
      sanitized[sanitizedKey] = sanitizeObject(value, config, isOutput);
    }
    
    return sanitized;
  }

  return obj;
}

function sanitizeString(str: string, config: any): string {
  if (typeof str !== 'string') return str;

  // Get the appropriate purify configuration
  const purifyConfig = config.customConfig || purifyConfigs[config.mode] || purifyConfigs.strict;

  // Sanitize the string
  let sanitized = purify.sanitize(str, purifyConfig);

  // Additional protection against specific patterns
  sanitized = preventScriptInjection(sanitized);
  sanitized = preventEventHandlers(sanitized);
  sanitized = preventDataURIs(sanitized, config.mode === 'rich' || config.mode === 'markdown');

  // Log if suspicious content was removed
  if (config.enableLogging && sanitized !== str) {
    console.warn('XSS Protection: Potentially malicious content sanitized', {
      original: str.substring(0, 100),
      sanitized: sanitized.substring(0, 100),
    });
  }

  return sanitized;
}

function preventScriptInjection(str: string): string {
  // Remove any variations of script tags
  const scriptPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*\/>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /import\s+.*from/gi, // ES6 imports
    /require\s*\(/gi, // CommonJS
  ];

  let result = str;
  for (const pattern of scriptPatterns) {
    result = result.replace(pattern, '');
  }

  return result;
}

function preventEventHandlers(str: string): string {
  // Remove inline event handlers
  const eventHandlerPattern = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
  return str.replace(eventHandlerPattern, '');
}

function preventDataURIs(str: string, allowImages = false): string {
  if (allowImages) {
    // Allow only image data URIs
    const dangerousDataURI = /data:(?!image\/(?:gif|jpeg|jpg|png|webp|svg\+xml))[^,]*,[^"'\s]*/gi;
    return str.replace(dangerousDataURI, '');
  } else {
    // Remove all data URIs
    const dataURI = /data:[^,]*,[^"'\s]*/gi;
    return str.replace(dataURI, '');
  }
}

// Middleware for output encoding
export function outputEncoding(req: Request, res: Response, next: NextFunction) {
  // Override res.send to ensure proper encoding
  const originalSend = res.send.bind(res);
  res.send = function(data: any) {
    if (typeof data === 'string') {
      // Set proper content type with charset
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    return originalSend(data);
  };

  // Override res.json to ensure proper encoding
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    // Set proper content type for JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(data);
  };

  next();
}

// React-specific XSS protection helpers for frontend
export const reactXSSHelpers = {
  // Sanitize HTML content for dangerouslySetInnerHTML
  sanitizeHTML: (html: string, mode: 'basic' | 'rich' = 'basic') => {
    const config = purifyConfigs[mode];
    return purify.sanitize(html, config);
  },

  // Sanitize URL for href/src attributes
  sanitizeURL: (url: string): string => {
    // Allow only safe protocols
    const safeProtocols = ['http:', 'https:', 'mailto:'];
    try {
      const parsed = new URL(url);
      if (!safeProtocols.includes(parsed.protocol)) {
        return '';
      }
      return url;
    } catch {
      // Relative URLs are okay
      if (url.startsWith('/') || url.startsWith('#')) {
        return url;
      }
      return '';
    }
  },

  // Escape HTML entities
  escapeHTML: (str: string): string => {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return str.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
  },
};

// Content-Type validation middleware
export function contentTypeValidation(allowedTypes: string[] = ['application/json']) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for requests without body
    if (!req.body || req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    const contentType = req.get('content-type');
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'Content-Type header is required',
      });
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    if (!isAllowed) {
      return res.status(415).json({
        success: false,
        error: `Unsupported Content-Type: ${contentType}`,
      });
    }

    next();
  };
}

// JSON parsing with size limit
export function safeJsonParsing(options: { limit?: string } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return next();
    }

    let data = '';
    const limit = options.limit || '1mb';
    const limitBytes = parseSize(limit);
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        return res.status(413).json({
          success: false,
          error: 'Request entity too large',
        });
      }
      data += chunk;
    });

    req.on('end', () => {
      try {
        req.body = JSON.parse(data);
        next();
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON',
        });
      }
    });
  };
}

function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)([a-z]+)$/);
  if (!match) return 1024 * 1024; // Default 1MB

  const [, num, unit] = match;
  return parseInt(num) * (units[unit] || 1);
}