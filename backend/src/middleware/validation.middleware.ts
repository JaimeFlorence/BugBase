import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { AppError } from './errorHandler';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// Sanitization helpers
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // Remove any HTML tags and scripts
    let sanitized = DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [] 
    });
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Escape special characters for SQL (though Prisma handles this)
    sanitized = sanitized.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case "\0": return "\\0";
        case "\x08": return "\\b";
        case "\x09": return "\\t";
        case "\x1a": return "\\z";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\"":
        case "'":
        case "\\":
        case "%": return "\\" + char;
        default: return char;
      }
    });
    
    return sanitized;
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeInput(key);
      sanitized[sanitizedKey] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

// Custom Zod types with built-in sanitization
export const sanitizedString = z.string().transform(sanitizeInput);
export const email = z.string().email().transform((val) => validator.normalizeEmail(val) || val);
export const url = z.string().url().transform((val) => validator.trim(val));
export const alphanumeric = z.string().regex(/^[a-zA-Z0-9]+$/, 'Must be alphanumeric');
export const username = z.string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'priority', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const idParamSchema = z.object({
  id: z.string().cuid('Invalid ID format'),
});

export const searchSchema = z.object({
  q: sanitizedString.min(1).max(100).optional(),
  search: sanitizedString.min(1).max(100).optional(),
});

// Request validation middleware factory
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and sanitize body
      if (schema.body) {
        const sanitizedBody = sanitizeInput(req.body);
        req.body = await schema.body.parseAsync(sanitizedBody);
      }
      
      // Validate and sanitize query parameters
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      
      // Validate and sanitize URL parameters
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors,
        });
      }
      
      next(error);
    }
  };
}

// Specific validation schemas for bug-related operations
export const bugSchemas = {
  create: z.object({
    projectId: z.string().cuid(),
    title: sanitizedString.min(1).max(200),
    description: sanitizedString.min(1).max(10000),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    severity: z.enum(['BLOCKER', 'MAJOR', 'MINOR', 'TRIVIAL']).optional(),
    assigneeId: z.string().cuid().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    estimatedHours: z.number().positive().max(1000).optional().nullable(),
    versionFound: sanitizedString.max(50).optional().nullable(),
    environment: sanitizedString.max(200).optional().nullable(),
    customFields: z.record(z.any()).optional(),
  }),
  
  update: z.object({
    title: sanitizedString.min(1).max(200).optional(),
    description: sanitizedString.min(1).max(10000).optional(),
    status: z.enum(['NEW', 'IN_PROGRESS', 'TESTING', 'RESOLVED', 'CLOSED', 'REOPENED']).optional(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    severity: z.enum(['BLOCKER', 'MAJOR', 'MINOR', 'TRIVIAL']).optional(),
    assigneeId: z.string().cuid().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    estimatedHours: z.number().positive().max(1000).optional().nullable(),
    actualHours: z.number().positive().max(1000).optional().nullable(),
    versionFound: sanitizedString.max(50).optional().nullable(),
    versionFixed: sanitizedString.max(50).optional().nullable(),
    environment: sanitizedString.max(200).optional().nullable(),
    customFields: z.record(z.any()).optional(),
  }),
  
  filters: z.object({
    projectId: z.string().cuid().optional(),
    status: z.enum(['NEW', 'IN_PROGRESS', 'TESTING', 'RESOLVED', 'CLOSED', 'REOPENED']).optional(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    severity: z.enum(['BLOCKER', 'MAJOR', 'MINOR', 'TRIVIAL']).optional(),
    assigneeId: z.string().cuid().optional(),
    reporterId: z.string().cuid().optional(),
    milestoneId: z.string().cuid().optional(),
    labels: z.array(sanitizedString).optional(),
    search: sanitizedString.max(100).optional(),
  }).merge(paginationSchema),
  
  addWatcher: z.object({
    userId: z.string().cuid(),
  }),
};

// Comment validation schemas
export const commentSchemas = {
  create: z.object({
    bugId: z.string().cuid(),
    content: sanitizedString.min(1).max(5000),
    parentId: z.string().cuid().optional().nullable(),
  }),
  
  update: z.object({
    content: sanitizedString.min(1).max(5000),
  }),
};

// Project validation schemas
export const projectSchemas = {
  create: z.object({
    name: sanitizedString.min(1).max(100),
    key: alphanumeric.min(2).max(10).toUpperCase(),
    description: sanitizedString.max(1000).optional().nullable(),
    icon: z.string().emoji().optional().nullable(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
    isPublic: z.boolean().optional(),
    settings: z.record(z.any()).optional(),
  }),
  
  update: z.object({
    name: sanitizedString.min(1).max(100).optional(),
    description: sanitizedString.max(1000).optional().nullable(),
    icon: z.string().emoji().optional().nullable(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
    isPublic: z.boolean().optional(),
    settings: z.record(z.any()).optional(),
  }),
  
  addMember: z.object({
    userId: z.string().cuid(),
    permissions: z.record(z.boolean()).optional(),
  }),
};

// Authentication validation schemas
export const authSchemas = {
  register: z.object({
    email: email,
    username: username,
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    fullName: sanitizedString.min(1).max(100),
    timezone: z.string().optional(),
  }),
  
  login: z.object({
    email: email,
    password: z.string().min(1).max(100),
  }),
  
  forgotPassword: z.object({
    email: email,
  }),
  
  resetPassword: z.object({
    token: z.string().min(1),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),
  
  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),
};

// File upload validation
export const fileUploadSchema = z.object({
  filename: sanitizedString.max(255),
  mimeType: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9\/\-+.]+$/, 'Invalid MIME type'),
  size: z.number().positive().max(10 * 1024 * 1024), // 10MB max
});

// SQL injection prevention (additional layer on top of Prisma)
export function preventSQLInjection(value: string): string {
  // List of SQL keywords to check
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'EXEC', 'EXECUTE', 'UNION', 'JOIN', '--', '/*', '*/', 'xp_', 'sp_'
  ];
  
  const upperValue = value.toUpperCase();
  for (const keyword of sqlKeywords) {
    if (upperValue.includes(keyword)) {
      throw new AppError('Potential SQL injection detected', 400);
    }
  }
  
  return value;
}

// NoSQL injection prevention for JSON fields
export function preventNoSQLInjection(obj: any): any {
  const dangerous = ['$where', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$regex'];
  
  const checkObject = (o: any): void => {
    if (typeof o === 'object' && o !== null) {
      for (const key of Object.keys(o)) {
        if (dangerous.includes(key)) {
          throw new AppError('Potential NoSQL injection detected', 400);
        }
        checkObject(o[key]);
      }
    }
  };
  
  checkObject(obj);
  return obj;
}

// Path traversal prevention
export function preventPathTraversal(path: string): string {
  const cleaned = path.replace(/\.\./g, '').replace(/\/\//g, '/');
  if (cleaned !== path) {
    throw new AppError('Invalid path', 400);
  }
  return cleaned;
}