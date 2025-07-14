#!/bin/bash

# Script to generate secure random secrets for production

echo "Generating secure secrets for BugBase production deployment..."
echo ""

# Function to generate random string
generate_secret() {
    length=$1
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate secrets
JWT_SECRET=$(generate_secret 64)
SESSION_SECRET=$(generate_secret 64)
PASSWORD_PEPPER=$(generate_secret 32)
COOKIE_SECRET=$(generate_secret 32)
DB_PASSWORD=$(generate_secret 32)
REDIS_PASSWORD=$(generate_secret 32)
GRAFANA_PASSWORD=$(generate_secret 16)

# Create .env.production file
cat > .env.production << EOF
# Production Environment Variables
# Generated on $(date)

# Application
NODE_ENV=production
VERSION=latest

# Database
DB_USER=bugbase
DB_PASSWORD=$DB_PASSWORD
DB_NAME=bugbase

# Redis
REDIS_PASSWORD=$REDIS_PASSWORD

# Security
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
PASSWORD_PEPPER=$PASSWORD_PEPPER
COOKIE_SECRET=$COOKIE_SECRET

# CORS
ALLOWED_ORIGINS=https://bugbase.example.com,https://www.bugbase.example.com

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY
SMTP_FROM=noreply@bugbase.example.com

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
SENTRY_DSN=
LOG_LEVEL=info
GRAFANA_PASSWORD=$GRAFANA_PASSWORD

# Backup
BACKUP_SCHEDULE=0 2 * * *
S3_BUCKET=bugbase-backups
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Docker Registry
DOCKER_REGISTRY=

# SSL/TLS
SSL_EMAIL=admin@bugbase.example.com
DOMAINS=bugbase.example.com,www.bugbase.example.com

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_OAUTH=false
ENABLE_2FA=true
MAINTENANCE_MODE=false

# External Services
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Analytics
GA_TRACKING_ID=
MIXPANEL_TOKEN=

# Performance
ENABLE_CACHE=true
CACHE_TTL=3600
ENABLE_COMPRESSION=true

# Security Headers
HSTS_MAX_AGE=31536000
CSP_REPORT_URI=
EOF

echo "✅ Secrets generated successfully!"
echo ""
echo "⚠️  IMPORTANT:"
echo "1. Review and update the .env.production file with your actual values"
echo "2. Keep this file secure and never commit it to version control"
echo "3. Back up these secrets in a secure password manager"
echo ""
echo "Generated secrets:"
echo "JWT_SECRET: $JWT_SECRET"
echo "SESSION_SECRET: $SESSION_SECRET"
echo "PASSWORD_PEPPER: $PASSWORD_PEPPER"
echo "COOKIE_SECRET: $COOKIE_SECRET"
echo "DB_PASSWORD: $DB_PASSWORD"
echo "REDIS_PASSWORD: $REDIS_PASSWORD"
echo "GRAFANA_PASSWORD: $GRAFANA_PASSWORD"