# The BugBase - Deployment Guide

## Overview
This document outlines the deployment process and infrastructure requirements for The BugBase.

## Development Environment

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Redis 6+
- Docker and Docker Compose
- Git

### Local Setup
```bash
# Clone repository
git clone [repository-url]
cd BugBase

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your local configuration

# Start services with Docker Compose
docker-compose up -d

# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Start development servers
npm run dev
```

### Environment Variables
```env
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bugbase
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
SESSION_SECRET=your-session-secret

# Storage
STORAGE_TYPE=local|s3|minio
S3_BUCKET=bugbase-uploads
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_ENDPOINT=http://localhost:9000

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@bugbase.com
SMTP_PASS=your-password
EMAIL_FROM=BugBase <notifications@bugbase.com>

# Frontend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## Production Deployment

### Infrastructure Requirements

#### Minimum Specifications
- **Web Server**: 2 vCPUs, 4GB RAM
- **Database**: 2 vCPUs, 8GB RAM, 100GB SSD
- **Redis**: 1 vCPU, 2GB RAM
- **Storage**: 100GB for file attachments

#### Recommended Specifications
- **Web Servers**: 2-3 instances (4 vCPUs, 8GB RAM each)
- **Database**: Managed PostgreSQL cluster (4 vCPUs, 16GB RAM)
- **Redis**: Managed Redis cluster
- **Storage**: Object storage (S3-compatible)
- **Load Balancer**: Application load balancer
- **CDN**: CloudFront or similar

### Docker Production Setup

```dockerfile
# Dockerfile.backend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

# Dockerfile.frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### Docker Compose Production
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=bugbase
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Deployment Steps

1. **Pre-deployment Checklist**
   - [ ] All tests passing
   - [ ] Security audit completed
   - [ ] Environment variables configured
   - [ ] SSL certificates obtained
   - [ ] Backup strategy in place

2. **Database Migration**
   ```bash
   # Run migrations
   npm run db:migrate:prod
   
   # Verify migration
   npm run db:status
   ```

3. **Build and Deploy**
   ```bash
   # Build Docker images
   docker build -t bugbase-backend:latest ./backend
   docker build -t bugbase-frontend:latest ./frontend
   
   # Push to registry
   docker push your-registry/bugbase-backend:latest
   docker push your-registry/bugbase-frontend:latest
   
   # Deploy with Docker Compose or Kubernetes
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Post-deployment**
   - [ ] Verify application health
   - [ ] Check monitoring dashboards
   - [ ] Test critical user flows
   - [ ] Monitor error rates

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push Docker images
        run: |
          docker build -t ${{ secrets.REGISTRY }}/bugbase-backend:${{ github.sha }} ./backend
          docker build -t ${{ secrets.REGISTRY }}/bugbase-frontend:${{ github.sha }} ./frontend
          docker push ${{ secrets.REGISTRY }}/bugbase-backend:${{ github.sha }}
          docker push ${{ secrets.REGISTRY }}/bugbase-frontend:${{ github.sha }}
      - name: Deploy to production
        run: |
          # Your deployment script here
```

## Monitoring & Maintenance

### Health Checks
- **API Health**: GET /api/health
- **Database**: Connection pool monitoring
- **Redis**: Memory usage and connection count
- **Storage**: Disk usage alerts

### Logging
- Application logs: Winston to file/CloudWatch
- Access logs: Nginx/ALB logs
- Error tracking: Sentry integration
- Audit logs: Database table

### Backup Strategy
- **Database**: Daily automated backups, 30-day retention
- **File Storage**: Versioned S3 bucket
- **Redis**: Periodic RDB snapshots
- **Configuration**: Version controlled

### Security Considerations
- [ ] HTTPS everywhere (SSL/TLS)
- [ ] Rate limiting implemented
- [ ] CORS properly configured
- [ ] Security headers (Helmet.js)
- [ ] Input validation and sanitization
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] Regular dependency updates

## Scaling Strategies

### Horizontal Scaling
- Load balancer with health checks
- Multiple backend instances
- Read replicas for database
- Redis cluster for sessions

### Performance Optimization
- CDN for static assets
- Database query optimization
- API response caching
- Image optimization
- Code splitting for frontend

## Troubleshooting

### Common Issues
1. **Database Connection Errors**
   - Check DATABASE_URL format
   - Verify network connectivity
   - Check connection pool settings

2. **File Upload Failures**
   - Verify storage permissions
   - Check file size limits
   - Confirm CORS settings

3. **WebSocket Connection Issues**
   - Check firewall rules
   - Verify proxy configuration
   - Confirm sticky sessions

### Rollback Procedure
```bash
# Quick rollback
docker-compose down
docker-compose up -d --scale backend=0
docker run -d your-registry/bugbase-backend:previous-version

# Database rollback
npm run db:rollback
```

## Support & Maintenance

### Regular Maintenance Tasks
- Weekly dependency updates
- Monthly security patches
- Quarterly performance reviews
- Annual disaster recovery drills

### Monitoring Alerts
- Response time > 2s
- Error rate > 1%
- CPU usage > 80%
- Memory usage > 85%
- Disk usage > 90%