# 🏆 BugBase Deployment Guide for Hostinger VPS

**Deploy BugBase to Hostinger VPS in under 15 minutes with zero manual configuration!**

## 🎯 Why Hostinger VPS is Perfect for BugBase

✅ **Ubuntu 22.04 LTS** with full root access  
✅ **AMD EPYC processors** for excellent performance  
✅ **NVMe SSD storage** for fast database operations  
✅ **Docker pre-installed** templates available  
✅ **KVM virtualization** for better isolation  
✅ **Excellent price/performance** ratio  
✅ **Built-in firewall** and security features  
✅ **Weekly backups** and snapshots included  

---

## 📋 Prerequisites

### 1. Hostinger VPS Account
- Active Hostinger VPS subscription
- Access to Hostinger control panel (hPanel)

### 2. Required Information
- **GitHub repository URL** for your BugBase fork
- **Domain name** you want to use (can be purchased through Hostinger)
- **Email address** for SSL certificates
- **SSH client** (Terminal on Mac/Linux, PuTTY on Windows)

### 3. Recommended VPS Plans

| Plan | vCPU | RAM | Storage | Price | Best For |
|------|------|-----|---------|-------|----------|
| **KVM 2** | 2 | 8GB | 100GB NVMe | $7.99/mo | Small teams (5-20 users) |
| **KVM 4** | 4 | 16GB | 200GB NVMe | $15.99/mo | Medium teams (20-100 users) |
| **KVM 8** | 8 | 32GB | 400GB NVMe | $29.99/mo | Large teams (100+ users) |

**💡 Recommendation**: Start with KVM 2 for testing, upgrade to KVM 4 for production use.

---

## 🚀 Step-by-Step Deployment

### Step 1: Create Your Hostinger VPS

1. **Log into Hostinger hPanel**
2. **Navigate to VPS** section
3. **Create New VPS** with these settings:
   - **Operating System**: Ubuntu 22.04 LTS with Docker (recommended)
   - **Plan**: KVM 2 or higher
   - **Data Center**: Choose closest to your users
   - **Hostname**: `bugbase-production`

4. **Wait for VPS setup** (usually 2-5 minutes)
5. **Note down**:
   - Server IP address
   - Root password (sent via email)
   - SSH access details

### Step 2: Domain Configuration

#### Option A: Use Hostinger Domain
1. **Purchase domain** through Hostinger (if needed)
2. **Go to DNS Zone** in hPanel
3. **Add A record**:
   - **Type**: A
   - **Name**: @ (for root domain) or subdomain
   - **Value**: Your VPS IP address
   - **TTL**: 3600

#### Option B: External Domain
1. **Update nameservers** to point to Hostinger:
   - `ns1.dns-parking.com`
   - `ns2.dns-parking.com`
2. **Follow Option A** steps above

### Step 3: SSH Access Setup

#### Connect to Your VPS
```bash
# Replace YOUR_VPS_IP with actual IP address
ssh root@YOUR_VPS_IP

# Enter the password sent to your email
# You'll be prompted to change it on first login
```

#### Security Setup (Optional but Recommended)
```bash
# Create SSH key for secure access (run on your local machine)
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Copy key to VPS (run on your local machine)
ssh-copy-id root@YOUR_VPS_IP

# Disable password authentication (run on VPS)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### Step 4: Download and Run BugBase Deployment

**🎉 This is where the magic happens - one command deploys everything!**

```bash
# Download the deployment script
curl -fsSL https://raw.githubusercontent.com/yourusername/bugbase/main/scripts/deploy-production.sh -o deploy-bugbase.sh
chmod +x deploy-bugbase.sh

# Run automated deployment with Hostinger optimizations
sudo ./deploy-bugbase.sh \
  --repo-url https://github.com/yourusername/bugbase.git \
  --domain your-domain.com \
  --email admin@your-domain.com \
  --hostinger

# Optional: Deploy specific branch
sudo ./deploy-bugbase.sh \
  --repo-url https://github.com/yourusername/bugbase.git \
  --domain your-domain.com \
  --email admin@your-domain.com \
  --branch develop \
  --hostinger
```

**⏱️ Deployment time**: 10-15 minutes depending on VPS speed and internet connection.

### Step 5: Verify Deployment

After deployment completes:

```bash
# Check application status
curl https://your-domain.com/api/health/live

# Check all services are running
docker-compose -f /opt/bugbase/docker-compose.production.yml ps

# View deployment summary
cat /opt/bugbase/deployment-summary.txt
```

---

## 🔧 Hostinger-Specific Optimizations

Our deployment script automatically applies these optimizations when `--hostinger` flag is used:

### 🚀 Performance Optimizations
- **Swap configuration** optimized for NVMe storage
- **AMD EPYC processor** tuning
- **Network stack** optimization for Hostinger infrastructure
- **Docker storage driver** optimization
- **Memory management** tuning for VPS environment

### 💾 Storage Optimizations
- **NVMe-specific** kernel parameters
- **Filesystem** optimizations for SSD
- **Log rotation** configured for space efficiency
- **Temporary files** moved to memory

### 🔒 Security Enhancements
- **UFW firewall** configured for Hostinger network
- **fail2ban** with VPS-optimized rules
- **SSH hardening** for cloud environment
- **Automatic security updates** enabled

---

## 📊 Monitoring Your BugBase Installation

### Access Monitoring Dashboard
```bash
# Grafana (monitoring dashboard)
https://your-domain.com:3001
# Login: admin
# Password: Check /opt/bugbase/.env.production

# Application health check
https://your-domain.com/api/health/detailed
```

### Useful Commands
```bash
# View application logs
docker-compose -f /opt/bugbase/docker-compose.production.yml logs -f

# Restart services
docker-compose -f /opt/bugbase/docker-compose.production.yml restart

# Check resource usage
htop
df -h
free -m

# Manual backup
/opt/bugbase/scripts/backup.sh

# Update application
cd /opt/bugbase
git pull
docker-compose -f docker-compose.production.yml up -d --build
```

---

## 🔧 Hostinger-Specific Configuration

### DNS Configuration
```bash
# Check DNS propagation
nslookup your-domain.com
dig your-domain.com

# Test SSL certificate
curl -I https://your-domain.com
```

### Hostinger Firewall Integration
```bash
# View UFW status (configured automatically)
ufw status verbose

# Allow additional ports if needed
ufw allow 8080  # Example: additional application port
```

### Backup to Hostinger Storage
```bash
# Configure S3-compatible backup (optional)
# Edit /opt/bugbase/.env.production
S3_BUCKET=your-hostinger-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=eu-central-1  # Hostinger's region

# Test backup
/opt/bugbase/scripts/backup.sh
```

---

## 🚨 Troubleshooting

### Common Hostinger VPS Issues

#### 1. **Memory Issues**
```bash
# Check memory usage
free -m

# If memory is low, our script auto-configures swap
swapon --show

# Manual swap creation if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 2. **Disk Space Issues**
```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a

# Clean old logs
find /opt/bugbase/logs -name "*.log" -mtime +7 -delete
```

#### 3. **Network Connectivity**
```bash
# Test DNS resolution
nslookup google.com

# Check if ports are accessible
netstat -tlnp | grep :443
netstat -tlnp | grep :80

# Test external connectivity
curl -I https://github.com
```

#### 4. **SSL Certificate Issues**
```bash
# Check certificate status
certbot certificates

# Renew certificate manually
certbot renew --dry-run

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -text -noout | grep "Not After"
```

### Getting Help

#### 🆘 **Hostinger Support**
- **Live Chat**: Available 24/7 in hPanel
- **Knowledge Base**: support.hostinger.com
- **Community**: Hostinger Facebook Group

#### 🛠️ **BugBase Support**
- **GitHub Issues**: Report bugs and get help
- **Documentation**: Comprehensive guides available
- **Email Support**: admin@your-domain.com

---

## 📈 Scaling Your Hostinger Deployment

### Vertical Scaling (Upgrade VPS)
1. **Login to hPanel**
2. **Go to VPS section**
3. **Click "Upgrade"** next to your VPS
4. **Select new plan**
5. **Confirm upgrade**
6. **Restart VPS** if required

**💡 Zero downtime upgrades** available for most plan changes.

### Horizontal Scaling (Multiple VPS)
```bash
# Setup load balancer with another Hostinger VPS
# Use our script on second VPS:
sudo ./deploy-bugbase.sh \
  --repo-url https://github.com/yourusername/bugbase.git \
  --domain app2.your-domain.com \
  --email admin@your-domain.com \
  --hostinger \
  --skip-ssl  # If using load balancer SSL

# Configure database clustering
# Use external database service for production
```

### Database Scaling
```bash
# Upgrade to managed PostgreSQL (recommended for production)
# 1. Export current database
docker-compose -f /opt/bugbase/docker-compose.production.yml exec postgres \
  pg_dump -U bugbase bugbase > bugbase_export.sql

# 2. Create managed database in Hostinger
# 3. Import data to managed database
# 4. Update connection string in .env.production
```

---

## 💰 Cost Optimization Tips

### 1. **Choose Right Plan**
- Start with KVM 2 for small teams
- Monitor resource usage with Grafana
- Upgrade only when needed

### 2. **Optimize Resource Usage**
```bash
# Enable automatic container cleanup
cat >> /etc/cron.daily/docker-cleanup << 'EOF'
#!/bin/bash
docker system prune -f
docker volume prune -f
EOF
chmod +x /etc/cron.daily/docker-cleanup
```

### 3. **Use Snapshots Wisely**
- Take snapshots before major updates
- Delete old snapshots regularly
- Use automated backups instead of frequent snapshots

### 4. **Monitor Bandwidth**
```bash
# Check bandwidth usage
vnstat -i eth0 -m

# Optimize images and static content
# Enable gzip compression (done automatically)
```

---

## 🎉 Success! Your BugBase is Live

After successful deployment, you'll have:

✅ **Production-ready BugBase** running on Hostinger VPS  
✅ **SSL certificate** with automatic renewal  
✅ **Monitoring dashboard** with Grafana  
✅ **Automated backups** configured  
✅ **Security hardening** applied  
✅ **Performance optimization** for Hostinger infrastructure  

### Next Steps:
1. **Test the application** at https://your-domain.com
2. **Create admin user** and invite team members
3. **Configure backup storage** (S3 compatible)
4. **Set up additional monitoring** if needed
5. **Plan scaling** based on usage

### 🚀 **Your BugBase instance is now ready for production use!**

---

## 📞 Support & Community

### 📧 **Get Help**
- **BugBase Issues**: GitHub repository issues
- **Hostinger Support**: 24/7 live chat in hPanel
- **Community**: Share your deployment success!

### 📚 **Additional Resources**
- [Complete User Guide](USERS_GUIDE.md)
- [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Security Implementation Guide](SECURITY_IMPLEMENTATION_GUIDE.md)
- [Testing Documentation](TESTING.md)

---

*🎯 **Deployed with confidence on Hostinger VPS** - The perfect hosting solution for BugBase!*