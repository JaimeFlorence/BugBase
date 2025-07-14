#!/bin/bash

# SSL/TLS Setup Script using Let's Encrypt

set -e

# Configuration
DOMAIN=${DOMAINS:-"bugbase.example.com,www.bugbase.example.com"}
EMAIL=${SSL_EMAIL:-"admin@bugbase.example.com"}
STAGING=${STAGING:-"false"}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "This script must be run as root"
fi

# Install certbot if not present
install_certbot() {
    log "Installing Certbot..."
    
    if ! command -v certbot &> /dev/null; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    else
        log "Certbot is already installed"
    fi
}

# Generate DH parameters
generate_dhparam() {
    log "Generating DH parameters (this may take a while)..."
    
    mkdir -p /etc/nginx/ssl
    
    if [ ! -f /etc/nginx/ssl/dhparam.pem ]; then
        openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048
        log "DH parameters generated successfully"
    else
        log "DH parameters already exist"
    fi
}

# Request SSL certificate
request_certificate() {
    log "Requesting SSL certificate for domains: $DOMAIN"
    
    # Build domain arguments
    DOMAIN_ARGS=""
    IFS=',' read -ra DOMAIN_ARRAY <<< "$DOMAIN"
    for d in "${DOMAIN_ARRAY[@]}"; do
        DOMAIN_ARGS="$DOMAIN_ARGS -d $d"
    done
    
    # Staging flag for testing
    STAGING_FLAG=""
    if [ "$STAGING" == "true" ]; then
        STAGING_FLAG="--staging"
        log "Using Let's Encrypt staging environment"
    fi
    
    # Request certificate
    certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        $STAGING_FLAG \
        $DOMAIN_ARGS \
        --non-interactive
    
    if [ $? -eq 0 ]; then
        log "SSL certificate obtained successfully"
    else
        error "Failed to obtain SSL certificate"
    fi
}

# Setup auto-renewal
setup_renewal() {
    log "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > /etc/cron.daily/certbot-renew << 'EOF'
#!/bin/bash
certbot renew --quiet --post-hook "docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T nginx nginx -s reload"
EOF
    
    chmod +x /etc/cron.daily/certbot-renew
    
    # Test renewal
    log "Testing certificate renewal..."
    certbot renew --dry-run
    
    if [ $? -eq 0 ]; then
        log "Automatic renewal configured successfully"
    else
        error "Certificate renewal test failed"
    fi
}

# Create required directories
setup_directories() {
    log "Creating required directories..."
    
    mkdir -p /var/www/certbot
    mkdir -p /etc/nginx/ssl/live
    mkdir -p /opt/bugbase/ssl
    
    # Set permissions
    chown -R www-data:www-data /var/www/certbot
}

# Main execution
main() {
    log "Starting SSL/TLS setup for BugBase..."
    
    # Create directories
    setup_directories
    
    # Install certbot
    install_certbot
    
    # Generate DH parameters
    generate_dhparam
    
    # Start nginx temporarily for certificate validation
    log "Starting temporary nginx for domain validation..."
    docker run -d --name temp-nginx \
        -v /var/www/certbot:/var/www/certbot \
        -p 80:80 \
        nginx:alpine
    
    sleep 5
    
    # Request certificate
    request_certificate
    
    # Stop temporary nginx
    docker stop temp-nginx && docker rm temp-nginx
    
    # Setup auto-renewal
    setup_renewal
    
    # Create symlinks for Docker
    ln -sf /etc/letsencrypt /opt/bugbase/ssl
    
    log "SSL/TLS setup completed successfully!"
    log ""
    log "Next steps:"
    log "1. Update your DNS records to point to this server"
    log "2. Update the domain names in nginx-lb.conf"
    log "3. Start the production stack: docker-compose -f docker-compose.production.yml up -d"
}

# Run main function
main "$@"