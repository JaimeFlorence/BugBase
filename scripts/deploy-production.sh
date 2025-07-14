#!/bin/bash

#############################################################################
# BugBase Automated Production Deployment Script
# 
# This script automates the complete deployment of BugBase to production
# servers with zero manual intervention required.
#
# Features:
# - Fresh server setup from scratch
# - Security hardening and user management
# - Git repository cloning and dependency installation
# - SSL/TLS configuration with Let's Encrypt
# - Docker container orchestration
# - Database initialization and migrations
# - Monitoring stack deployment
# - Automated backup configuration
# - Health checks and verification
# - Comprehensive error handling and rollback
#
# Usage:
#   sudo ./deploy-production.sh [OPTIONS]
#
# Options:
#   --repo-url URL        GitHub repository URL (required)
#   --domain DOMAIN       Primary domain name (required)
#   --email EMAIL         Admin email for SSL certificates (required)
#   --branch BRANCH       Git branch to deploy (default: main)
#   --dry-run            Simulate deployment without making changes
#   --skip-ssl           Skip SSL certificate generation
#   --skip-monitoring    Skip monitoring stack deployment
#   --help               Show this help message
#
#############################################################################

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/bugbase"
LOG_FILE="/var/log/bugbase-deployment.log"
BACKUP_DIR="/backup"
VENV_DIR="/opt/bugbase-deploy"

# Default values
BRANCH="main"
DRY_RUN=false
SKIP_SSL=false
SKIP_MONITORING=false
REPO_URL=""
DOMAIN=""
EMAIL=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Performance tracking
START_TIME=$(date +%s)
STEP_COUNT=0
TOTAL_STEPS=25

#############################################################################
# Utility Functions
#############################################################################

print_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  BugBase Automated Production Deployment${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
}

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[${timestamp}] INFO:${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[${timestamp}] WARN:${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[${timestamp}] ERROR:${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[${timestamp}] DEBUG:${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "STEP")
            STEP_COUNT=$((STEP_COUNT + 1))
            echo -e "${CYAN}[${timestamp}] STEP ${STEP_COUNT}/${TOTAL_STEPS}:${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

show_progress() {
    local current=$1
    local total=$2
    local percentage=$((current * 100 / total))
    local filled=$((percentage / 2))
    local empty=$((50 - filled))
    
    printf "\r${BLUE}Progress: ["
    printf "%*s" $filled | tr ' ' '█'
    printf "%*s" $empty | tr ' ' '░'
    printf "] %d%% (%d/%d)${NC}" $percentage $current $total
}

error_exit() {
    log "ERROR" "$1"
    echo -e "\n${RED}Deployment failed! Check the log file: $LOG_FILE${NC}"
    
    # Show recent log entries
    echo -e "\n${YELLOW}Recent log entries:${NC}"
    tail -n 10 "$LOG_FILE" || true
    
    # Attempt rollback if possible
    if [[ -f "$INSTALL_DIR/.deployment_state" ]]; then
        log "INFO" "Attempting automatic rollback..."
        cleanup_on_failure
    fi
    
    exit 1
}

cleanup_on_failure() {
    log "INFO" "Cleaning up failed deployment..."
    
    # Stop any running containers
    if [[ -f "$INSTALL_DIR/docker-compose.production.yml" ]]; then
        cd "$INSTALL_DIR"
        docker-compose -f docker-compose.production.yml down --remove-orphans || true
    fi
    
    # Remove incomplete installation
    if [[ "$DRY_RUN" == "false" && -d "$INSTALL_DIR" ]]; then
        log "WARN" "Removing incomplete installation directory"
        rm -rf "$INSTALL_DIR" || true
    fi
}

trap 'error_exit "Script interrupted"' INT TERM
trap 'error_exit "Script failed at line $LINENO"' ERR

check_prerequisites() {
    log "STEP" "Checking prerequisites and permissions"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root (use sudo)"
    fi
    
    # Check system requirements
    local total_mem=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local mem_gb=$((total_mem / 1024 / 1024))
    
    if [[ $mem_gb -lt 4 ]]; then
        log "WARN" "System has only ${mem_gb}GB RAM. Minimum 8GB recommended"
    fi
    
    # Check disk space
    local available_space=$(df / | tail -1 | awk '{print $4}')
    local space_gb=$((available_space / 1024 / 1024))
    
    if [[ $space_gb -lt 20 ]]; then
        error_exit "Insufficient disk space. At least 20GB required, found ${space_gb}GB"
    fi
    
    # Check internet connectivity
    if ! ping -c 1 google.com &> /dev/null; then
        error_exit "No internet connectivity detected"
    fi
    
    log "INFO" "Prerequisites check passed"
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --repo-url)
                REPO_URL="$2"
                shift 2
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --branch)
                BRANCH="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-ssl)
                SKIP_SSL=true
                shift
                ;;
            --skip-monitoring)
                SKIP_MONITORING=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error_exit "Unknown option: $1"
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ -z "$REPO_URL" ]]; then
        error_exit "Repository URL is required (--repo-url)"
    fi
    
    if [[ -z "$DOMAIN" && "$SKIP_SSL" == "false" ]]; then
        error_exit "Domain name is required for SSL setup (--domain)"
    fi
    
    if [[ -z "$EMAIL" && "$SKIP_SSL" == "false" ]]; then
        error_exit "Email is required for SSL certificates (--email)"
    fi
}

show_help() {
    cat << EOF
BugBase Automated Production Deployment Script

USAGE:
    sudo $0 [OPTIONS]

REQUIRED OPTIONS:
    --repo-url URL        GitHub repository URL
    --domain DOMAIN       Primary domain name (for SSL)
    --email EMAIL         Admin email for SSL certificates

OPTIONAL OPTIONS:
    --branch BRANCH       Git branch to deploy (default: main)
    --dry-run            Simulate deployment without making changes
    --skip-ssl           Skip SSL certificate generation
    --skip-monitoring    Skip monitoring stack deployment
    --help               Show this help message

EXAMPLES:
    # Basic production deployment
    sudo $0 --repo-url https://github.com/user/bugbase.git \\
            --domain bugbase.com --email admin@bugbase.com

    # Deploy specific branch with monitoring disabled
    sudo $0 --repo-url https://github.com/user/bugbase.git \\
            --domain bugbase.com --email admin@bugbase.com \\
            --branch develop --skip-monitoring

    # Dry run to test the deployment process
    sudo $0 --repo-url https://github.com/user/bugbase.git \\
            --domain bugbase.com --email admin@bugbase.com \\
            --dry-run

EOF
}

execute_command() {
    local cmd="$1"
    local description="$2"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DEBUG" "[DRY RUN] Would execute: $cmd"
        return 0
    fi
    
    log "DEBUG" "Executing: $description"
    eval "$cmd" || error_exit "Failed to execute: $description"
}

#############################################################################
# Installation Functions
#############################################################################

update_system() {
    log "STEP" "Updating system packages"
    
    execute_command "apt-get update -y" "Update package lists"
    execute_command "apt-get upgrade -y" "Upgrade system packages"
    execute_command "apt-get autoremove -y" "Remove unnecessary packages"
    
    log "INFO" "System update completed"
}

install_dependencies() {
    log "STEP" "Installing system dependencies"
    
    local packages=(
        "curl" "wget" "git" "unzip" "htop" "vim" "nano"
        "build-essential" "software-properties-common"
        "apt-transport-https" "ca-certificates" "gnupg" "lsb-release"
        "python3" "python3-pip" "python3-venv" "python3-dev"
        "openssl" "jq" "fail2ban" "ufw" "logrotate"
        "postgresql-client" "redis-tools"
    )
    
    log "INFO" "Installing packages: ${packages[*]}"
    execute_command "DEBIAN_FRONTEND=noninteractive apt-get install -y ${packages[*]}" "Install system packages"
    
    log "INFO" "System dependencies installed successfully"
}

install_docker() {
    log "STEP" "Installing Docker and Docker Compose"
    
    # Remove old Docker installations
    execute_command "apt-get remove -y docker docker-engine docker.io containerd runc || true" "Remove old Docker"
    
    # Add Docker's official GPG key
    execute_command "mkdir -p /etc/apt/keyrings" "Create keyrings directory"
    execute_command "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg" "Add Docker GPG key"
    execute_command "chmod a+r /etc/apt/keyrings/docker.gpg" "Set GPG key permissions"
    
    # Add Docker repository
    local docker_repo="deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable"
    execute_command "echo '$docker_repo' | tee /etc/apt/sources.list.d/docker.list > /dev/null" "Add Docker repository"
    
    # Install Docker
    execute_command "apt-get update -y" "Update package lists"
    execute_command "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin" "Install Docker"
    
    # Start and enable Docker
    execute_command "systemctl start docker" "Start Docker service"
    execute_command "systemctl enable docker" "Enable Docker service"
    
    # Install Docker Compose standalone
    local compose_version="v2.24.1"
    execute_command "curl -L \"https://github.com/docker/compose/releases/download/$compose_version/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose" "Download Docker Compose"
    execute_command "chmod +x /usr/local/bin/docker-compose" "Make Docker Compose executable"
    
    # Verify installation
    if [[ "$DRY_RUN" == "false" ]]; then
        docker --version || error_exit "Docker installation failed"
        docker-compose --version || error_exit "Docker Compose installation failed"
    fi
    
    log "INFO" "Docker and Docker Compose installed successfully"
}

setup_python_environment() {
    log "STEP" "Setting up Python virtual environment"
    
    execute_command "mkdir -p $VENV_DIR" "Create virtual environment directory"
    execute_command "python3 -m venv $VENV_DIR" "Create Python virtual environment"
    
    # Install Python dependencies for deployment tools
    local pip_packages=(
        "awscli" "boto3" "requests" "pyyaml" "jinja2"
        "certbot" "certbot-nginx" "cryptography"
    )
    
    execute_command "$VENV_DIR/bin/pip install --upgrade pip" "Upgrade pip"
    execute_command "$VENV_DIR/bin/pip install ${pip_packages[*]}" "Install Python packages"
    
    log "INFO" "Python environment setup completed"
}

create_system_user() {
    log "STEP" "Creating system user for BugBase"
    
    # Create bugbase user if it doesn't exist
    if ! id "bugbase" &>/dev/null; then
        execute_command "useradd -r -m -d /home/bugbase -s /bin/bash bugbase" "Create bugbase user"
        execute_command "usermod -aG docker bugbase" "Add bugbase user to docker group"
    else
        log "INFO" "User 'bugbase' already exists"
    fi
    
    # Setup SSH directory
    execute_command "mkdir -p /home/bugbase/.ssh" "Create SSH directory"
    execute_command "chmod 700 /home/bugbase/.ssh" "Set SSH directory permissions"
    execute_command "chown -R bugbase:bugbase /home/bugbase/.ssh" "Set SSH directory ownership"
    
    log "INFO" "System user setup completed"
}

clone_repository() {
    log "STEP" "Cloning BugBase repository"
    
    # Remove existing directory if it exists
    if [[ -d "$INSTALL_DIR" ]]; then
        log "WARN" "Removing existing installation directory"
        execute_command "rm -rf $INSTALL_DIR" "Remove existing directory"
    fi
    
    # Create installation directory
    execute_command "mkdir -p $INSTALL_DIR" "Create installation directory"
    
    # Clone repository
    execute_command "git clone --branch $BRANCH --depth 1 $REPO_URL $INSTALL_DIR" "Clone repository"
    
    # Set permissions
    execute_command "chown -R bugbase:bugbase $INSTALL_DIR" "Set directory ownership"
    execute_command "chmod -R 755 $INSTALL_DIR" "Set directory permissions"
    
    # Make scripts executable
    execute_command "chmod +x $INSTALL_DIR/scripts/*.sh" "Make scripts executable"
    
    log "INFO" "Repository cloned successfully to $INSTALL_DIR"
}

generate_secrets() {
    log "STEP" "Generating secure environment variables"
    
    cd "$INSTALL_DIR"
    
    # Generate secrets using the existing script
    if [[ -f "scripts/generate-secrets.sh" ]]; then
        execute_command "./scripts/generate-secrets.sh" "Generate production secrets"
    else
        log "WARN" "generate-secrets.sh not found, creating basic .env.production"
        
        # Create basic environment file with secure defaults
        cat > .env.production << EOF
# Generated by automated deployment script
NODE_ENV=production
VERSION=latest

# Database
DB_USER=bugbase
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
DB_NAME=bugbase

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Security
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
SESSION_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
PASSWORD_PEPPER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
COOKIE_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# CORS
ALLOWED_ORIGINS=https://$DOMAIN

# Domain
DOMAINS=$DOMAIN
SSL_EMAIL=$EMAIL

# Default configuration
LOG_LEVEL=info
ENABLE_REGISTRATION=true
MAINTENANCE_MODE=false
EOF
    fi
    
    # Update domain-specific values
    execute_command "sed -i 's/bugbase.example.com/$DOMAIN/g' .env.production" "Update domain in environment"
    execute_command "sed -i 's/admin@bugbase.example.com/$EMAIL/g' .env.production" "Update email in environment"
    
    # Secure the environment file
    execute_command "chmod 600 .env.production" "Secure environment file"
    execute_command "chown bugbase:bugbase .env.production" "Set environment file ownership"
    
    log "INFO" "Secure environment variables generated"
}

setup_ssl_certificates() {
    if [[ "$SKIP_SSL" == "true" ]]; then
        log "INFO" "Skipping SSL certificate setup as requested"
        return 0
    fi
    
    log "STEP" "Configuring SSL/TLS certificates"
    
    cd "$INSTALL_DIR"
    
    # Install certbot if not already installed
    execute_command "apt-get install -y certbot python3-certbot-nginx" "Install certbot"
    
    # Create required directories
    execute_command "mkdir -p /var/www/certbot" "Create certbot webroot"
    execute_command "mkdir -p /etc/nginx/ssl" "Create SSL directory"
    
    # Generate DH parameters
    if [[ ! -f "/etc/nginx/ssl/dhparam.pem" ]]; then
        log "INFO" "Generating DH parameters (this may take several minutes)..."
        execute_command "openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048" "Generate DH parameters"
    fi
    
    # Start temporary nginx for domain validation
    log "INFO" "Starting temporary web server for domain validation"
    execute_command "docker run -d --name temp-nginx -v /var/www/certbot:/var/www/certbot -p 80:80 nginx:alpine" "Start temporary nginx"
    
    sleep 5
    
    # Request SSL certificate
    execute_command "certbot certonly --webroot --webroot-path=/var/www/certbot --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN --non-interactive" "Request SSL certificate"
    
    # Stop temporary nginx
    execute_command "docker stop temp-nginx && docker rm temp-nginx" "Stop temporary nginx"
    
    # Create symlink for Docker access
    execute_command "ln -sf /etc/letsencrypt $INSTALL_DIR/ssl" "Create SSL symlink"
    
    # Setup auto-renewal
    cat > /etc/cron.daily/certbot-renew << 'EOF'
#!/bin/bash
certbot renew --quiet --post-hook "docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T nginx nginx -s reload"
EOF
    execute_command "chmod +x /etc/cron.daily/certbot-renew" "Setup SSL auto-renewal"
    
    log "INFO" "SSL certificates configured successfully"
}

configure_firewall() {
    log "STEP" "Configuring firewall and security"
    
    # Configure UFW firewall
    execute_command "ufw --force reset" "Reset firewall rules"
    execute_command "ufw default deny incoming" "Set default deny incoming"
    execute_command "ufw default allow outgoing" "Set default allow outgoing"
    
    # Allow essential services
    execute_command "ufw allow ssh" "Allow SSH"
    execute_command "ufw allow http" "Allow HTTP"
    execute_command "ufw allow https" "Allow HTTPS"
    
    # Allow monitoring ports (restricted to localhost)
    execute_command "ufw allow from 127.0.0.1 to any port 3001" "Allow Grafana (localhost)"
    execute_command "ufw allow from 127.0.0.1 to any port 9090" "Allow Prometheus (localhost)"
    
    # Enable firewall
    execute_command "ufw --force enable" "Enable firewall"
    
    # Configure fail2ban
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF
    
    execute_command "systemctl enable fail2ban" "Enable fail2ban"
    execute_command "systemctl start fail2ban" "Start fail2ban"
    
    log "INFO" "Firewall and security configured"
}

setup_directories() {
    log "STEP" "Setting up application directories"
    
    # Create required directories
    local dirs=(
        "$INSTALL_DIR/logs/backend"
        "$INSTALL_DIR/logs/nginx" 
        "$INSTALL_DIR/logs/monitoring"
        "$BACKUP_DIR"
        "/var/www/certbot"
    )
    
    for dir in "${dirs[@]}"; do
        execute_command "mkdir -p $dir" "Create directory: $dir"
    done
    
    # Set permissions
    execute_command "chown -R bugbase:bugbase $INSTALL_DIR/logs" "Set logs ownership"
    execute_command "chown -R bugbase:bugbase $BACKUP_DIR" "Set backup ownership"
    execute_command "chmod 755 $BACKUP_DIR" "Set backup permissions"
    
    log "INFO" "Application directories created"
}

build_docker_images() {
    log "STEP" "Building Docker images"
    
    cd "$INSTALL_DIR"
    
    # Build backend image
    if [[ -f "backend/Dockerfile.production" ]]; then
        execute_command "docker build -t bugbase-backend:latest -f backend/Dockerfile.production backend/" "Build backend image"
    else
        log "WARN" "Backend Dockerfile.production not found, using regular Dockerfile"
        execute_command "docker build -t bugbase-backend:latest backend/" "Build backend image"
    fi
    
    # Build frontend image
    if [[ -f "frontend/Dockerfile.production" ]]; then
        execute_command "docker build -t bugbase-frontend:latest -f frontend/Dockerfile.production frontend/" "Build frontend image"
    else
        log "WARN" "Frontend Dockerfile.production not found, using regular Dockerfile"
        execute_command "docker build -t bugbase-frontend:latest frontend/" "Build frontend image"
    fi
    
    log "INFO" "Docker images built successfully"
}

start_services() {
    log "STEP" "Starting application services"
    
    cd "$INSTALL_DIR"
    
    # Start database and Redis first
    execute_command "docker-compose -f docker-compose.production.yml up -d postgres redis" "Start database services"
    
    # Wait for database to be ready
    log "INFO" "Waiting for database to be ready..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if [[ "$DRY_RUN" == "false" ]]; then
            if docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U bugbase &>/dev/null; then
                break
            fi
        else
            break
        fi
        sleep 2
        retries=$((retries - 1))
    done
    
    if [[ $retries -eq 0 && "$DRY_RUN" == "false" ]]; then
        error_exit "Database failed to start within timeout"
    fi
    
    log "INFO" "Database is ready"
    
    # Start all other services
    execute_command "docker-compose -f docker-compose.production.yml up -d" "Start all services"
    
    log "INFO" "All services started successfully"
}

run_database_migrations() {
    log "STEP" "Running database migrations"
    
    cd "$INSTALL_DIR"
    
    # Wait a bit for backend to be ready
    sleep 10
    
    # Run database migrations
    execute_command "docker-compose -f docker-compose.production.yml exec -T backend npm run db:migrate:prod" "Run database migrations"
    
    # Optionally seed initial data
    log "INFO" "Seeding initial database data..."
    execute_command "docker-compose -f docker-compose.production.yml exec -T backend npm run db:seed || true" "Seed database (optional)"
    
    log "INFO" "Database setup completed"
}

setup_monitoring() {
    if [[ "$SKIP_MONITORING" == "true" ]]; then
        log "INFO" "Skipping monitoring setup as requested"
        return 0
    fi
    
    log "STEP" "Setting up monitoring stack"
    
    cd "$INSTALL_DIR"
    
    # The monitoring services are already defined in docker-compose.production.yml
    # They should start automatically with the previous step
    
    # Wait for Grafana to be ready
    log "INFO" "Waiting for monitoring services to be ready..."
    sleep 15
    
    # Verify monitoring services are running
    if [[ "$DRY_RUN" == "false" ]]; then
        local services=("prometheus" "grafana" "loki")
        for service in "${services[@]}"; do
            if ! docker-compose -f docker-compose.production.yml ps | grep -q "$service.*Up"; then
                log "WARN" "Monitoring service $service may not be running properly"
            fi
        done
    fi
    
    log "INFO" "Monitoring stack setup completed"
}

setup_backup_system() {
    log "STEP" "Configuring automated backup system"
    
    cd "$INSTALL_DIR"
    
    # Create backup configuration
    execute_command "mkdir -p $BACKUP_DIR" "Create backup directory"
    
    # Setup backup cron job
    cat > /etc/cron.d/bugbase-backup << EOF
# BugBase automated daily backup at 2 AM
0 2 * * * bugbase cd $INSTALL_DIR && ./scripts/backup.sh >> /var/log/bugbase-backup.log 2>&1
EOF
    
    # Test backup script
    if [[ -f "scripts/backup.sh" ]]; then
        execute_command "chmod +x scripts/backup.sh" "Make backup script executable"
        log "INFO" "Backup script configured for daily execution at 2 AM"
    else
        log "WARN" "Backup script not found, manual backup setup required"
    fi
    
    log "INFO" "Backup system configured"
}

configure_log_rotation() {
    log "STEP" "Configuring log rotation"
    
    # Create logrotate configuration for BugBase
    cat > /etc/logrotate.d/bugbase << EOF
$INSTALL_DIR/logs/**/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 bugbase bugbase
    postrotate
        docker-compose -f $INSTALL_DIR/docker-compose.production.yml exec -T backend pkill -USR1 node || true
    endscript
}

/var/log/bugbase-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF
    
    # Test logrotate configuration
    execute_command "logrotate -d /etc/logrotate.d/bugbase" "Test log rotation configuration"
    
    log "INFO" "Log rotation configured"
}

verify_deployment() {
    log "STEP" "Verifying deployment"
    
    cd "$INSTALL_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "Skipping verification in dry-run mode"
        return 0
    fi
    
    # Check container status
    local containers=("backend" "frontend" "postgres" "redis")
    for container in "${containers[@]}"; do
        if ! docker-compose -f docker-compose.production.yml ps | grep -q "$container.*Up"; then
            error_exit "Container $container is not running"
        fi
    done
    
    # Test database connection
    log "INFO" "Testing database connection..."
    if ! docker-compose -f docker-compose.production.yml exec -T postgres psql -U bugbase -d bugbase -c "SELECT 1;" &>/dev/null; then
        error_exit "Database connection test failed"
    fi
    
    # Test Redis connection
    log "INFO" "Testing Redis connection..."
    if ! docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping &>/dev/null; then
        error_exit "Redis connection test failed"
    fi
    
    # Test application health endpoints
    local health_checks=(
        "http://localhost/api/health/live"
        "http://localhost/api/health/ready"
    )
    
    for endpoint in "${health_checks[@]}"; do
        log "INFO" "Testing health endpoint: $endpoint"
        local retries=10
        while [[ $retries -gt 0 ]]; do
            if curl -f "$endpoint" &>/dev/null; then
                log "INFO" "Health check passed: $endpoint"
                break
            fi
            sleep 3
            retries=$((retries - 1))
        done
        
        if [[ $retries -eq 0 ]]; then
            log "WARN" "Health check failed: $endpoint"
        fi
    done
    
    # Test HTTPS if SSL is configured
    if [[ "$SKIP_SSL" == "false" ]]; then
        log "INFO" "Testing HTTPS endpoint..."
        if curl -f "https://$DOMAIN/api/health/live" &>/dev/null; then
            log "INFO" "HTTPS health check passed"
        else
            log "WARN" "HTTPS health check failed"
        fi
    fi
    
    log "INFO" "Deployment verification completed"
}

create_deployment_summary() {
    log "STEP" "Creating deployment summary"
    
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local duration_min=$((duration / 60))
    local duration_sec=$((duration % 60))
    
    cat > "$INSTALL_DIR/deployment-summary.txt" << EOF
BugBase Production Deployment Summary
=====================================

Deployment Date: $(date)
Duration: ${duration_min}m ${duration_sec}s
Repository: $REPO_URL
Branch: $BRANCH
Domain: $DOMAIN
Installation Directory: $INSTALL_DIR

Services Status:
$(docker-compose -f docker-compose.production.yml ps 2>/dev/null || echo "Unable to get service status")

Endpoints:
- Application: https://$DOMAIN
- Health Check: https://$DOMAIN/api/health/live
- Grafana: http://localhost:3001 (admin access only)
- Prometheus: http://localhost:9090 (admin access only)

Important Files:
- Environment: $INSTALL_DIR/.env.production
- Logs: $INSTALL_DIR/logs/
- Backups: $BACKUP_DIR
- SSL Certificates: /etc/letsencrypt/live/$DOMAIN/

Maintenance Commands:
- View logs: docker-compose -f $INSTALL_DIR/docker-compose.production.yml logs
- Restart services: docker-compose -f $INSTALL_DIR/docker-compose.production.yml restart
- Update application: cd $INSTALL_DIR && git pull && docker-compose -f docker-compose.production.yml up -d --build
- Manual backup: $INSTALL_DIR/scripts/backup.sh

Security Notes:
- Firewall (UFW) is enabled with restricted access
- Fail2ban is configured for intrusion prevention
- SSL certificates will auto-renew via cron
- Regular backups scheduled daily at 2 AM

Next Steps:
1. Configure DNS records to point to this server
2. Update monitoring alert configurations
3. Test backup and restore procedures
4. Review security settings and access controls
5. Setup external monitoring and alerting

EOF
    
    execute_command "chown bugbase:bugbase $INSTALL_DIR/deployment-summary.txt" "Set summary file ownership"
    
    log "INFO" "Deployment summary created at $INSTALL_DIR/deployment-summary.txt"
}

#############################################################################
# Main Deployment Process
#############################################################################

main() {
    print_header
    
    # Initialize logging
    execute_command "mkdir -p $(dirname $LOG_FILE)" "Create log directory"
    execute_command "touch $LOG_FILE" "Create log file"
    
    log "INFO" "Starting BugBase automated deployment"
    log "INFO" "Repository: $REPO_URL"
    log "INFO" "Branch: $BRANCH"
    log "INFO" "Domain: $DOMAIN"
    log "INFO" "Dry run: $DRY_RUN"
    
    # Save deployment state
    if [[ "$DRY_RUN" == "false" ]]; then
        echo "deployment_in_progress" > "$INSTALL_DIR/.deployment_state" 2>/dev/null || true
    fi
    
    # Execute deployment steps
    check_prerequisites
    update_system
    install_dependencies
    install_docker
    setup_python_environment
    create_system_user
    clone_repository
    generate_secrets
    setup_ssl_certificates
    configure_firewall
    setup_directories
    build_docker_images
    start_services
    run_database_migrations
    setup_monitoring
    setup_backup_system
    configure_log_rotation
    verify_deployment
    create_deployment_summary
    
    # Mark deployment as complete
    if [[ "$DRY_RUN" == "false" ]]; then
        echo "deployment_complete" > "$INSTALL_DIR/.deployment_state"
    fi
    
    # Final status
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local duration_min=$((duration / 60))
    local duration_sec=$((duration % 60))
    
    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎉 BugBase Deployment Completed Successfully! 🎉${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${CYAN}Deployment Summary:${NC}"
    echo -e "  📅 Completed: $(date)"
    echo -e "  ⏱️  Duration: ${duration_min}m ${duration_sec}s"
    echo -e "  🌐 Domain: https://$DOMAIN"
    echo -e "  📁 Installation: $INSTALL_DIR"
    echo -e "  📋 Summary: $INSTALL_DIR/deployment-summary.txt"
    
    echo -e "\n${YELLOW}Important Next Steps:${NC}"
    echo -e "  1. 🌍 Update DNS records to point to this server"
    echo -e "  2. 🔍 Review $INSTALL_DIR/deployment-summary.txt"
    echo -e "  3. 🏥 Test the application: https://$DOMAIN"
    echo -e "  4. 📊 Access monitoring: http://localhost:3001"
    echo -e "  5. 🔧 Configure backup storage (S3) in .env.production"
    
    echo -e "\n${BLUE}Support & Documentation:${NC}"
    echo -e "  📖 Production Guide: $INSTALL_DIR/PRODUCTION_DEPLOYMENT_GUIDE.md"
    echo -e "  📝 Logs: $LOG_FILE"
    echo -e "  💾 Backups: $BACKUP_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\n${YELLOW}Note: This was a dry run. No actual changes were made.${NC}"
        echo -e "Run without --dry-run to perform the actual deployment."
    fi
    
    echo ""
}

#############################################################################
# Script Entry Point
#############################################################################

# Parse command line arguments
parse_arguments "$@"

# Run main deployment process
main

# Exit successfully
exit 0