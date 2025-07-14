# Production Deployment Guide for BugBase

## Overview
This guide provides step-by-step instructions for deploying BugBase to production using Docker, GitHub Actions CI/CD, and comprehensive monitoring.

## Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04 LTS or newer
- **CPU**: Minimum 4 cores, recommended 8 cores
- **RAM**: Minimum 8GB, recommended 16GB
- **Storage**: 100GB SSD (more for data growth)
- **Network**: Static IP, ports 80, 443 open

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- AWS CLI (for S3 backups)
- Domain name with DNS control

## 🚀 Deployment Steps

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install required tools
sudo apt install -y git make nginx certbot python3-certbot-nginx awscli
```

### 2. Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/bugbase
sudo chown $USER:$USER /opt/bugbase
cd /opt/bugbase

# Clone repository
git clone https://github.com/yourusername/bugbase.git .
```

### 3. Generate Secrets

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Generate secure secrets
./scripts/generate-secrets.sh

# Edit .env.production with your values
nano .env.production
```

### 4. Setup SSL/TLS

```bash
# Update domain in configuration
sed -i 's/bugbase.example.com/yourdomain.com/g' nginx-lb.conf
sed -i 's/bugbase.example.com/yourdomain.com/g' .env.production

# Run SSL setup
sudo ./scripts/setup-ssl.sh
```

### 5. Build and Deploy

```bash
# Build images
docker-compose -f docker-compose.production.yml build

# Or pull from registry if using CI/CD
docker-compose -f docker-compose.production.yml pull

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

### 6. Initialize Database

```bash
# Run database migrations
docker-compose -f docker-compose.production.yml exec backend npm run db:migrate:prod

# Seed initial data (optional)
docker-compose -f docker-compose.production.yml exec backend npm run db:seed
```

### 7. Verify Deployment

```bash
# Check health endpoints
curl http://localhost/api/health/live
curl http://localhost/api/health/ready
curl https://yourdomain.com/api/health/detailed

# Check logs
docker-compose -f docker-compose.production.yml logs -f
```

## 📊 Monitoring Setup

### 1. Access Monitoring Tools

- **Grafana**: http://your-server:3001
  - Default user: admin
  - Password: Set in GRAFANA_PASSWORD

- **Prometheus**: http://your-server:9090

### 2. Configure Alerts

Edit `monitoring/alerts/application.yml` to set alert thresholds and notification channels.

### 3. Setup Log Aggregation

Logs are automatically collected by Promtail and sent to Loki. View in Grafana.

## 🔄 CI/CD Configuration

### 1. GitHub Secrets

Add these secrets to your GitHub repository:

```
DOCKER_USERNAME
DOCKER_PASSWORD
STAGING_HOST
STAGING_USER
STAGING_SSH_KEY
PRODUCTION_HOST
PRODUCTION_USER
PRODUCTION_SSH_KEY
SLACK_WEBHOOK
```

### 2. Deployment Workflow

- **Push to `develop`**: Deploys to staging
- **Create release**: Deploys to production
- **Pull requests**: Run tests only

## 🔒 Security Checklist

- [ ] Change all default passwords
- [ ] Configure firewall (ufw or iptables)
- [ ] Enable fail2ban
- [ ] Setup SSH key authentication
- [ ] Disable root login
- [ ] Configure unattended upgrades
- [ ] Enable audit logging
- [ ] Configure backup encryption
- [ ] Setup VPN for admin access

## 💾 Backup Configuration

### 1. Automated Backups

```bash
# Setup backup cron
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/bugbase/scripts/backup.sh >> /var/log/bugbase-backup.log 2>&1
```

### 2. Configure S3 Backup

```bash
# Configure AWS credentials
aws configure

# Update S3 bucket in .env.production
S3_BUCKET=your-backup-bucket
```

### 3. Test Backup/Restore

```bash
# Run manual backup
./scripts/backup.sh

# List backups
./scripts/restore.sh --list

# Test restore (in staging first!)
./scripts/restore.sh --timestamp 20240114_020000
```

## 🚨 Disaster Recovery

### 1. Emergency Procedures

1. **Service Down**:
   ```bash
   # Quick restart
   docker-compose -f docker-compose.production.yml restart backend
   
   # Full restart
   docker-compose -f docker-compose.production.yml down
   docker-compose -f docker-compose.production.yml up -d
   ```

2. **Database Issues**:
   ```bash
   # Check database
   docker-compose -f docker-compose.production.yml exec postgres psql -U bugbase -c "\l"
   
   # Emergency backup
   docker-compose -f docker-compose.production.yml exec postgres pg_dump -U bugbase bugbase > emergency_backup.sql
   ```

3. **Disk Full**:
   ```bash
   # Check disk usage
   df -h
   
   # Clean Docker
   docker system prune -a
   
   # Clean old logs
   find /opt/bugbase/logs -name "*.log" -mtime +30 -delete
   ```

### 2. Rollback Procedure

```bash
# Stop current version
docker-compose -f docker-compose.production.yml stop backend frontend

# Pull previous version
docker-compose -f docker-compose.production.yml pull backend:previous_tag

# Start previous version
docker-compose -f docker-compose.production.yml up -d
```

## 📈 Performance Tuning

### 1. Database Optimization

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_bugs_search ON bugs USING gin(to_tsvector('english', title || ' ' || description));

-- Analyze tables
ANALYZE bugs;
ANALYZE comments;
ANALYZE users;
```

### 2. Redis Optimization

```bash
# Check memory usage
docker-compose -f docker-compose.production.yml exec redis redis-cli INFO memory

# Configure max memory
docker-compose -f docker-compose.production.yml exec redis redis-cli CONFIG SET maxmemory 2gb
```

### 3. Nginx Optimization

Update `nginx-lb.conf` for your traffic patterns:
- Adjust worker_connections
- Configure caching
- Enable compression

## 🔧 Maintenance

### Daily Tasks
- Check monitoring dashboards
- Review error logs
- Verify backups completed

### Weekly Tasks
- Review security logs
- Check disk usage
- Update dependencies (staging first)

### Monthly Tasks
- Security patches
- Performance review
- Backup restoration test
- Certificate renewal check

## 📱 Mobile App Deployment

If deploying mobile apps:

1. Update API endpoints in app config
2. Configure push notifications
3. Update app store listings
4. Test deep linking

## 🌍 Multi-Region Deployment

For global deployment:

1. Setup CDN (CloudFlare, AWS CloudFront)
2. Configure GeoDNS
3. Setup read replicas in other regions
4. Configure data replication

## 📞 Support Contacts

- **System Admin**: admin@company.com
- **DevOps Team**: devops@company.com
- **Security Team**: security@company.com
- **24/7 Support**: +1-xxx-xxx-xxxx

## 🐛 Troubleshooting

### Common Issues

1. **Container won't start**:
   - Check logs: `docker-compose logs backend`
   - Verify environment variables
   - Check disk space

2. **Database connection errors**:
   - Verify PostgreSQL is running
   - Check connection string
   - Review firewall rules

3. **SSL certificate issues**:
   - Check certificate expiry
   - Verify domain DNS
   - Review nginx configuration

4. **High memory usage**:
   - Check for memory leaks
   - Review Redis usage
   - Optimize queries

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Backup current system
- [ ] Review change log
- [ ] Test in staging
- [ ] Notify users of maintenance
- [ ] Prepare rollback plan

### Deployment
- [ ] Pull latest code
- [ ] Run database migrations
- [ ] Update configurations
- [ ] Deploy new version
- [ ] Verify health checks

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify all features working
- [ ] Update documentation
- [ ] Close deployment ticket

## 🎉 Success Criteria

Your deployment is successful when:
- All health checks pass
- No error spike in logs
- Performance metrics normal
- Users can access all features
- Backups are running
- Monitoring is active

---

**Remember**: Always test in staging first, keep backups current, and have a rollback plan ready!