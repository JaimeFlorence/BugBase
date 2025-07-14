import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request, Response, NextFunction } from 'express';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(logColors);

// Create format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define transports
const transports: winston.transport[] = [];

// Console transport
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // In production, still log to console but in JSON format
  transports.push(
    new winston.transports.Console({
      format: format,
    })
  );
}

// File transport - errors
transports.push(
  new DailyRotateFile({
    filename: path.join('logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: format,
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true,
  })
);

// File transport - all logs
transports.push(
  new DailyRotateFile({
    filename: path.join('logs', 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: format,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: format,
  transports: transports,
  exitOnError: false,
});

// Create stream for Morgan HTTP logger
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Request logger middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log request
  logger.http(`Incoming ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - start;
    
    logger.http(`Outgoing ${req.method} ${req.url} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length'),
    });

    return originalSend.call(this, data);
  };

  next();
};

// Error logger middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error occurred', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
    },
  });

  next(err);
};

// Security event logger
export const securityLogger = {
  logFailedLogin: (email: string, ip: string, reason: string) => {
    logger.warn('Failed login attempt', {
      event: 'failed_login',
      email,
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  logSuccessfulLogin: (userId: string, email: string, ip: string) => {
    logger.info('Successful login', {
      event: 'successful_login',
      userId,
      email,
      ip,
      timestamp: new Date().toISOString(),
    });
  },

  logSuspiciousActivity: (userId: string | null, activity: string, details: any) => {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  logSecurityViolation: (userId: string | null, violation: string, details: any) => {
    logger.error('Security violation', {
      event: 'security_violation',
      userId,
      violation,
      details,
      timestamp: new Date().toISOString(),
    });
  },
};

// Application event logger
export const appLogger = {
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },

  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },

  error: (message: string, error?: Error | any, meta?: any) => {
    logger.error(message, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
      ...meta,
    });
  },

  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
};

// Performance logger
export const performanceLogger = {
  logSlowQuery: (query: string, duration: number, params?: any) => {
    logger.warn('Slow database query', {
      event: 'slow_query',
      query,
      duration,
      params,
      timestamp: new Date().toISOString(),
    });
  },

  logSlowRequest: (url: string, method: string, duration: number) => {
    logger.warn('Slow HTTP request', {
      event: 'slow_request',
      url,
      method,
      duration,
      timestamp: new Date().toISOString(),
    });
  },

  logHighMemoryUsage: (usage: number) => {
    logger.warn('High memory usage', {
      event: 'high_memory',
      usage,
      timestamp: new Date().toISOString(),
    });
  },
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing logger');
  logger.end();
});

export default logger;