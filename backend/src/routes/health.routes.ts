import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import os from 'os';
import fs from 'fs/promises';

const router = Router();
const prisma = new PrismaClient();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      message?: string;
      duration?: number;
    };
  };
}

// Liveness probe - basic check if service is running
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe - check if service is ready to accept traffic
router.get('/ready', async (req: Request, res: Response) => {
  const checks: HealthStatus['checks'] = {};
  let isReady = true;

  // Check database connection
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'healthy',
      duration: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: 'Database connection failed',
      duration: Date.now() - dbStart,
    };
    isReady = false;
  }

  // Check Redis connection
  const redisStart = Date.now();
  try {
    const redis = createClient({
      url: process.env.REDIS_URL,
    });
    await redis.connect();
    await redis.ping();
    await redis.disconnect();
    
    checks.redis = {
      status: 'healthy',
      duration: Date.now() - redisStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      message: 'Redis connection failed',
      duration: Date.now() - redisStart,
    };
    // Redis is not critical for readiness
  }

  const status: HealthStatus = {
    status: isReady ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    checks,
  };

  res.status(isReady ? 200 : 503).json(status);
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const checks: HealthStatus['checks'] = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Database check with connection pool info
  const dbStart = Date.now();
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as connection_count,
        MAX(query_start) as last_query
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    checks.database = {
      status: 'healthy',
      message: `Connections: ${result[0].connection_count}`,
      duration: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - dbStart,
    };
    overallStatus = 'unhealthy';
  }

  // Redis check with memory info
  const redisStart = Date.now();
  try {
    const redis = createClient({
      url: process.env.REDIS_URL,
    });
    await redis.connect();
    const info = await redis.info('memory');
    await redis.disconnect();
    
    const usedMemory = info.match(/used_memory_human:(.+)/)?.[1] || 'unknown';
    
    checks.redis = {
      status: 'healthy',
      message: `Memory used: ${usedMemory}`,
      duration: Date.now() - redisStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - redisStart,
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // Disk space check
  try {
    const stats = await fs.statfs('/');
    const totalSpace = stats.blocks * stats.bsize;
    const freeSpace = stats.bavail * stats.bsize;
    const usedPercentage = ((totalSpace - freeSpace) / totalSpace * 100).toFixed(2);
    
    checks.diskSpace = {
      status: parseFloat(usedPercentage) < 90 ? 'healthy' : 'unhealthy',
      message: `${usedPercentage}% used`,
    };
    
    if (parseFloat(usedPercentage) >= 90) {
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.diskSpace = {
      status: 'unhealthy',
      message: 'Unable to check disk space',
    };
  }

  // Memory check
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemoryPercentage = ((totalMemory - freeMemory) / totalMemory * 100).toFixed(2);
  
  checks.memory = {
    status: parseFloat(usedMemoryPercentage) < 90 ? 'healthy' : 'unhealthy',
    message: `${usedMemoryPercentage}% used (${Math.round(freeMemory / 1024 / 1024)}MB free)`,
  };
  
  if (parseFloat(usedMemoryPercentage) >= 90) {
    overallStatus = 'degraded';
  }

  // CPU check
  const cpuUsage = process.cpuUsage();
  const cpuPercentage = ((cpuUsage.user + cpuUsage.system) / 1000000 / process.uptime() * 100).toFixed(2);
  
  checks.cpu = {
    status: parseFloat(cpuPercentage) < 80 ? 'healthy' : 'unhealthy',
    message: `${cpuPercentage}% average usage`,
  };
  
  if (parseFloat(cpuPercentage) >= 80) {
    overallStatus = 'degraded';
  }

  // External services check (example: email service)
  if (process.env.SMTP_HOST) {
    const emailStart = Date.now();
    try {
      const net = require('net');
      const client = new net.Socket();
      
      await new Promise<void>((resolve, reject) => {
        client.setTimeout(5000);
        client.connect(parseInt(process.env.SMTP_PORT || '587'), process.env.SMTP_HOST, () => {
          client.destroy();
          resolve();
        });
        client.on('error', reject);
        client.on('timeout', () => {
          client.destroy();
          reject(new Error('Connection timeout'));
        });
      });
      
      checks.emailService = {
        status: 'healthy',
        duration: Date.now() - emailStart,
      };
    } catch (error) {
      checks.emailService = {
        status: 'unhealthy',
        message: 'SMTP connection failed',
        duration: Date.now() - emailStart,
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  }

  const response: HealthStatus & {
    system?: {
      hostname: string;
      platform: string;
      arch: string;
      nodeVersion: string;
      loadAverage: number[];
    };
  } = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    checks,
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      loadAverage: os.loadavg(),
    },
  };

  res.status(overallStatus === 'healthy' ? 200 : 503).json(response);
});

// Metrics endpoint for Prometheus
router.get('/metrics', async (req: Request, res: Response) => {
  const metrics: string[] = [];

  // Basic metrics
  metrics.push(`# HELP app_info Application information`);
  metrics.push(`# TYPE app_info gauge`);
  metrics.push(`app_info{version="${process.env.VERSION || 'unknown'}",environment="${process.env.NODE_ENV || 'development'}"} 1`);

  // Uptime
  metrics.push(`# HELP process_uptime_seconds Process uptime in seconds`);
  metrics.push(`# TYPE process_uptime_seconds gauge`);
  metrics.push(`process_uptime_seconds ${process.uptime()}`);

  // Memory usage
  const memUsage = process.memoryUsage();
  metrics.push(`# HELP process_memory_heap_used_bytes Process heap memory used`);
  metrics.push(`# TYPE process_memory_heap_used_bytes gauge`);
  metrics.push(`process_memory_heap_used_bytes ${memUsage.heapUsed}`);

  metrics.push(`# HELP process_memory_heap_total_bytes Process heap memory total`);
  metrics.push(`# TYPE process_memory_heap_total_bytes gauge`);
  metrics.push(`process_memory_heap_total_bytes ${memUsage.heapTotal}`);

  // CPU usage
  const cpuUsage = process.cpuUsage();
  metrics.push(`# HELP process_cpu_user_seconds_total Process CPU user time`);
  metrics.push(`# TYPE process_cpu_user_seconds_total counter`);
  metrics.push(`process_cpu_user_seconds_total ${cpuUsage.user / 1000000}`);

  metrics.push(`# HELP process_cpu_system_seconds_total Process CPU system time`);
  metrics.push(`# TYPE process_cpu_system_seconds_total counter`);
  metrics.push(`process_cpu_system_seconds_total ${cpuUsage.system / 1000000}`);

  // Database connection pool metrics (if available)
  try {
    const poolStats = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as active_connections,
        MAX(query_start) as last_query_time
      FROM pg_stat_activity 
      WHERE datname = current_database() AND state = 'active'
    `;

    metrics.push(`# HELP database_active_connections Number of active database connections`);
    metrics.push(`# TYPE database_active_connections gauge`);
    metrics.push(`database_active_connections ${poolStats[0].active_connections}`);
  } catch (error) {
    // Ignore errors in metrics collection
  }

  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

export default router;