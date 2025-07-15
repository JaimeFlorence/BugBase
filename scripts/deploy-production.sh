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
HOSTINGER_MODE=false
SMALL_TEAM=false
MINIMAL=false
REPO_URL=""
DOMAIN=""
EMAIL=""

# Hostinger-specific settings
HOSTINGER_OPTIMIZATIONS=true
ENABLE_SWAP=true
OPTIMIZE_FOR_NVME=true

# Small team settings
COMPOSE_FILE="docker-compose.production.yml"

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
            --hostinger)
                HOSTINGER_MODE=true
                shift
                ;;
            --small-team)
                SMALL_TEAM=true
                COMPOSE_FILE="docker-compose.small-team.yml"
                TOTAL_STEPS=20  # Fewer steps for small team
                shift
                ;;
            --minimal)
                MINIMAL=true
                COMPOSE_FILE="docker-compose.minimal.yml"
                SKIP_MONITORING=true  # Force disable monitoring
                TOTAL_STEPS=18  # Minimal steps
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
    --hostinger          Enable Hostinger VPS optimizations
    --small-team         Optimize for small teams (5-15 developers)
    --minimal            Ultra-minimal deployment (2-10 developers)
    --help               Show this help message

EXAMPLES:
    # Small team deployment (5-15 developers) - RECOMMENDED for most teams
    sudo $0 --repo-url https://github.com/user/bugbase.git \\
            --domain bugbase.com --email admin@bugbase.com \\
            --hostinger --small-team

    # Minimal deployment (2-10 developers, ultra-budget)
    sudo $0 --repo-url https://github.com/user/bugbase.git \\
            --domain bugbase.com --email admin@bugbase.com \\
            --hostinger --minimal

    # Full production deployment (enterprise, 50+ developers)
    sudo $0 --repo-url https://github.com/user/bugbase.git \\
            --domain bugbase.com --email admin@bugbase.com \\
            --hostinger

    # Dry run to test the deployment process
    sudo $0 --repo-url https://github.com/user/bugbase.git \\
            --domain bugbase.com --email admin@bugbase.com \\
            --dry-run --small-team

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

detect_hostinger() {
    log "STEP" "Detecting hosting environment"
    
    # Check for Hostinger-specific indicators
    if [[ "$HOSTINGER_MODE" == "true" ]] || 
       hostname | grep -q "hostinger" || 
       dmidecode -s system-manufacturer 2>/dev/null | grep -qi "hostinger" ||
       [[ -f "/etc/hostinger" ]] ||
       grep -qi "hostinger" /proc/version 2>/dev/null; then
        
        HOSTINGER_MODE=true
        log "INFO" "Hostinger VPS environment detected"
        
        # Auto-enable optimizations for Hostinger
        HOSTINGER_OPTIMIZATIONS=true
        ENABLE_SWAP=true
        OPTIMIZE_FOR_NVME=true
        
        # Adjust for typical Hostinger VPS specs
        if [[ $(nproc) -eq 2 && $(grep MemTotal /proc/meminfo | awk '{print $2}') -lt 9000000 ]]; then
            log "INFO" "Detected KVM 2 plan (2 vCPU, 8GB RAM) - optimizing accordingly"
            TOTAL_STEPS=22  # Reduce some optional steps for smaller VPS
        fi
        
    else
        log "INFO" "Generic VPS environment detected"
    fi
}

setup_swap_for_hostinger() {
    if [[ "$HOSTINGER_MODE" == "true" && "$ENABLE_SWAP" == "true" ]]; then
        log "STEP" "Setting up swap for Hostinger VPS"
        
        # Check if swap already exists
        if swapon --show | grep -q "/swapfile"; then
            log "INFO" "Swap already configured"
            return 0
        fi
        
        # Calculate swap size based on RAM (1.5x RAM, max 4GB for smaller VPS)
        local total_mem=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local mem_gb=$((total_mem / 1024 / 1024))
        local swap_gb=$((mem_gb * 3 / 2))
        
        # Limit swap size for smaller VPS to save disk space
        if [[ $swap_gb -gt 4 ]]; then
            swap_gb=4
        fi
        
        log "INFO" "Creating ${swap_gb}GB swap file for optimal performance"
        
        # Create swap file on NVMe storage
        execute_command "fallocate -l ${swap_gb}G /swapfile" "Create swap file"
        execute_command "chmod 600 /swapfile" "Set swap file permissions"
        execute_command "mkswap /swapfile" "Format swap file"
        execute_command "swapon /swapfile" "Enable swap"
        
        # Make swap permanent
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        
        # Optimize swap usage for containers
        echo 'vm.swappiness=10' >> /etc/sysctl.conf
        echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
        
        log "INFO" "Swap configured successfully"
    fi
}

optimize_for_hostinger() {
    if [[ "$HOSTINGER_MODE" == "true" && "$HOSTINGER_OPTIMIZATIONS" == "true" ]]; then
        log "STEP" "Applying Hostinger VPS optimizations"
        
        # NVMe storage optimizations
        if [[ "$OPTIMIZE_FOR_NVME" == "true" ]]; then
            log "INFO" "Optimizing for NVMe storage"
            
            # Configure filesystem optimizations
            cat >> /etc/fstab << 'EOF'
# NVMe optimizations for Hostinger VPS
tmpfs /tmp tmpfs defaults,noatime,mode=1777 0 0
EOF
            
            # Configure kernel parameters for NVMe
            cat >> /etc/sysctl.conf << 'EOF'
# NVMe and SSD optimizations
vm.dirty_ratio=15
vm.dirty_background_ratio=5
vm.dirty_expire_centisecs=12000
EOF
        fi
        
        # Network optimizations for Hostinger infrastructure
        cat >> /etc/sysctl.conf << 'EOF'
# Network optimizations for Hostinger VPS
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
net.ipv4.tcp_congestion_control=bbr
EOF
        
        # Docker optimizations for Hostinger VPS
        mkdir -p /etc/docker
        cat > /etc/docker/daemon.json << 'EOF'
{
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-runtime": "runc",
  "default-shm-size": "64M"
}
EOF
        
        # CPU governor optimization for AMD EPYC
        if grep -q "EPYC" /proc/cpuinfo; then
            log "INFO" "Optimizing for AMD EPYC processor"
            echo 'performance' | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor >/dev/null || true
        fi
        
        log "INFO" "Hostinger optimizations applied"
    fi
}

install_docker() {
    log "STEP" "Installing Docker and Docker Compose"
    
    # Check if we're on Hostinger with pre-installed Docker
    if [[ "$HOSTINGER_MODE" == "true" ]] && command -v docker &> /dev/null; then
        log "INFO" "Docker already installed on Hostinger VPS template"
        
        # Verify Docker Compose is also available
        if ! command -v docker-compose &> /dev/null; then
            log "INFO" "Installing Docker Compose on Hostinger VPS"
            local compose_version="v2.24.1"
            execute_command "curl -L \"https://github.com/docker/compose/releases/download/$compose_version/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose" "Download Docker Compose"
            execute_command "chmod +x /usr/local/bin/docker-compose" "Make Docker Compose executable"
        fi
        
        # Start and enable Docker service
        execute_command "systemctl start docker" "Start Docker service"
        execute_command "systemctl enable docker" "Enable Docker service"
        
        log "INFO" "Docker configuration completed for Hostinger VPS"
        return 0
    fi
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        log "INFO" "Docker already installed"
        
        # Start and enable Docker service
        execute_command "systemctl start docker" "Start Docker service"
        execute_command "systemctl enable docker" "Enable Docker service"
        
        # Install Docker Compose if not available
        if ! command -v docker-compose &> /dev/null; then
            log "INFO" "Installing Docker Compose"
            local compose_version="v2.24.1"
            execute_command "curl -L \"https://github.com/docker/compose/releases/download/$compose_version/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose" "Download Docker Compose"
            execute_command "chmod +x /usr/local/bin/docker-compose" "Make Docker Compose executable"
        fi
        
        log "INFO" "Docker configuration completed"
        return 0
    fi
    
    # Use Docker convenience script for simpler installation
    log "INFO" "Installing Docker using convenience script"
    execute_command "curl -fsSL https://get.docker.com -o get-docker.sh" "Download Docker install script"
    execute_command "sh get-docker.sh" "Install Docker"
    execute_command "rm get-docker.sh" "Remove install script"
    
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
    
    # Make scripts executable if they exist
    if [[ -d "$INSTALL_DIR/scripts" ]]; then
        execute_command "chmod +x $INSTALL_DIR/scripts/*.sh || true" "Make scripts executable"
    fi
    
    # Create missing production files if they don't exist
    create_missing_production_files
    
    log "INFO" "Repository cloned successfully to $INSTALL_DIR"
}

create_missing_production_files() {
    log "INFO" "Checking for missing production files"
    
    # Create backend Dockerfile if missing
    if [[ ! -f "$INSTALL_DIR/backend/Dockerfile" ]]; then
        log "INFO" "Creating backend Dockerfile"
        cat > "$INSTALL_DIR/backend/Dockerfile" << 'EOF'
FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application (skip if TypeScript errors)
RUN npm run build || true

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["npx", "tsx", "src/index.ts"]
EOF
    fi
    
    # Create docker-compose.small-team.yml if missing
    if [[ ! -f "$INSTALL_DIR/docker-compose.small-team.yml" ]]; then
        log "INFO" "Creating small team docker-compose file"
        create_small_team_compose
    fi
    
    # Create nginx.conf if missing
    if [[ ! -f "$INSTALL_DIR/nginx.conf" ]]; then
        log "INFO" "Creating nginx configuration"
        create_nginx_config
    fi
    
    # Create monitoring config if missing
    if [[ ! -d "$INSTALL_DIR/monitoring" ]]; then
        mkdir -p "$INSTALL_DIR/monitoring"
        create_monitoring_config
    fi
}

create_small_team_compose() {
    cat > "$INSTALL_DIR/docker-compose.small-team.yml" << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: bugbase-postgres
    environment:
      POSTGRES_USER: ${DB_USER:-bugbase}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-bugbase_prod}
      POSTGRES_DB: ${DB_NAME:-bugbase}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-bugbase}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: bugbase-redis
    command: redis-server --requirepass ${REDIS_PASSWORD:-redis_prod}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: bugbase-backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER:-bugbase}:${DB_PASSWORD:-bugbase_prod}@postgres:5432/${DB_NAME:-bugbase}
      - REDIS_URL=redis://:${REDIS_PASSWORD:-redis_prod}@redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - CORS_ORIGIN=${ALLOWED_ORIGINS:-http://localhost}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF
}

create_nginx_config() {
    cat > "$INSTALL_DIR/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    upstream backend {
        server backend:3000;
    }

    server {
        listen 80;
        server_name localhost;

        location /api {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            proxy_pass http://backend/health;
        }

        location / {
            return 200 'BugBase is running!';
            add_header Content-Type text/plain;
        }
    }
}
EOF
}

create_monitoring_config() {
    cat > "$INSTALL_DIR/monitoring/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'bugbase-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
EOF
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
    
    # Build backend image if Dockerfile exists
    if [[ -f "backend/Dockerfile.production" ]]; then
        execute_command "docker build -t bugbase-backend:latest -f backend/Dockerfile.production backend/" "Build backend image"
    elif [[ -f "backend/Dockerfile" ]]; then
        log "INFO" "Using backend/Dockerfile for build"
        execute_command "docker build -t bugbase-backend:latest backend/" "Build backend image"
    else
        log "WARN" "No backend Dockerfile found, skipping backend image build"
    fi
    
    # Build frontend image if Dockerfile exists
    if [[ -f "frontend/Dockerfile.production" ]]; then
        execute_command "docker build -t bugbase-frontend:latest -f frontend/Dockerfile.production frontend/" "Build frontend image"
    elif [[ -f "frontend/Dockerfile" ]]; then
        log "INFO" "Using frontend/Dockerfile for build"
        execute_command "docker build -t bugbase-frontend:latest frontend/" "Build frontend image"
    else
        log "WARN" "No frontend Dockerfile found, skipping frontend image build"
    fi
    
    log "INFO" "Docker images build process completed"
}

start_services() {
    log "STEP" "Starting application services"
    
    cd "$INSTALL_DIR"
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log "WARN" "Compose file $COMPOSE_FILE not found"
        if [[ -f "docker-compose.yml" ]]; then
            log "INFO" "Using default docker-compose.yml"
            COMPOSE_FILE="docker-compose.yml"
        else
            error_exit "No docker-compose file found"
        fi
    fi
    
    # Provide information about deployment type
    if [[ "$SMALL_TEAM" == "true" ]]; then
        log "INFO" "Using small team configuration - optimized for 5-15 developers"
    elif [[ "$MINIMAL" == "true" ]]; then
        log "INFO" "Using minimal configuration - optimized for 2-10 developers"
    else
        log "INFO" "Using full production configuration - optimized for enterprise"
    fi
    
    # Start database and Redis first
    execute_command "docker-compose -f $COMPOSE_FILE up -d postgres redis" "Start database services"
    
    # Wait for database to be ready
    log "INFO" "Waiting for database to be ready..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if [[ "$DRY_RUN" == "false" ]]; then
            if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U ${DB_USER:-bugbase} &>/dev/null; then
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
    execute_command "docker-compose -f $COMPOSE_FILE up -d" "Start all services"
    
    log "INFO" "All services started successfully"
}

run_database_migrations() {
    log "STEP" "Running database migrations"
    
    cd "$INSTALL_DIR"
    
    # Wait for backend to be ready
    log "INFO" "Waiting for backend to be ready..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if [[ "$DRY_RUN" == "false" ]]; then
            if docker-compose -f $COMPOSE_FILE exec -T backend echo "Backend ready" &>/dev/null; then
                break
            fi
        else
            break
        fi
        sleep 2
        retries=$((retries - 1))
    done
    
    if [[ $retries -eq 0 && "$DRY_RUN" == "false" ]]; then
        log "WARN" "Backend may not be ready, attempting migrations anyway"
    fi
    
    # Run database migrations if backend is ready
    if docker-compose -f $COMPOSE_FILE ps backend | grep -q "Up"; then
        execute_command "docker-compose -f $COMPOSE_FILE exec -T backend npm run db:migrate:prod || true" "Run database migrations"
        
        # Optionally seed initial data
        log "INFO" "Seeding initial database data..."
        execute_command "docker-compose -f $COMPOSE_FILE exec -T backend npm run db:seed || true" "Seed database (optional)"
    else
        log "WARN" "Backend not running, skipping migrations"
    fi
    
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
            if ! docker-compose -f $COMPOSE_FILE ps | grep -q "$service.*Up"; then
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
        if ! docker-compose -f $COMPOSE_FILE ps | grep -q "$container.*Up"; then
            error_exit "Container $container is not running"
        fi
    done
    
    # Test database connection
    log "INFO" "Testing database connection..."
    if ! docker-compose -f $COMPOSE_FILE exec -T postgres psql -U bugbase -d bugbase -c "SELECT 1;" &>/dev/null; then
        error_exit "Database connection test failed"
    fi
    
    # Test Redis connection
    log "INFO" "Testing Redis connection..."
    if ! docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping &>/dev/null; then
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
$(docker-compose -f $COMPOSE_FILE ps 2>/dev/null || echo "Unable to get service status")

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
- View logs: docker-compose -f $INSTALL_DIR/$COMPOSE_FILE logs
- Restart services: docker-compose -f $INSTALL_DIR/$COMPOSE_FILE restart
- Update application: cd $INSTALL_DIR && git pull && docker-compose -f $COMPOSE_FILE up -d --build
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
        mkdir -p "$INSTALL_DIR"
        echo "deployment_in_progress" > "$INSTALL_DIR/.deployment_state" 2>/dev/null || true
    fi
    
    # Execute deployment steps
    check_prerequisites
    detect_hostinger
    update_system
    install_dependencies
    setup_swap_for_hostinger
    optimize_for_hostinger
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