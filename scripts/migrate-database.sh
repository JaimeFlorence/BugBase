#!/bin/bash

# Database Migration Script for Production
# This script safely applies database migrations with backup and rollback support

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/backup/migrations"
LOG_FILE="/var/log/bugbase/migrations.log"
LOCK_FILE="/tmp/bugbase-migration.lock"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if another migration is running
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        error "Another migration is already running (lock file exists)"
        exit 1
    fi
    
    # Create lock file
    echo $$ > "$LOCK_FILE"
    trap 'rm -f "$LOCK_FILE"' EXIT
}

# Create backup before migration
create_backup() {
    log "Creating database backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/pre_migration_$TIMESTAMP.sql"
    
    mkdir -p "$BACKUP_DIR"
    
    # Create backup using pg_dump
    if docker-compose -f docker-compose.production.yml exec -T postgres \
        pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"; then
        log "Backup created successfully: $BACKUP_FILE"
        
        # Compress backup
        gzip "$BACKUP_FILE"
        BACKUP_FILE="$BACKUP_FILE.gz"
        
        # Upload to S3 if configured
        if [ -n "$S3_BUCKET" ]; then
            aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/migrations/" || \
                warning "Failed to upload backup to S3"
        fi
        
        echo "$BACKUP_FILE"
    else
        error "Failed to create backup"
        exit 1
    fi
}

# Check migration status
check_migration_status() {
    log "Checking current migration status..."
    
    docker-compose -f docker-compose.production.yml run --rm backend \
        npx prisma migrate status || true
}

# Apply migrations
apply_migrations() {
    log "Applying database migrations..."
    
    # Run migrations in production mode
    if docker-compose -f docker-compose.production.yml run --rm backend \
        npx prisma migrate deploy; then
        log "Migrations applied successfully"
        return 0
    else
        error "Migration failed"
        return 1
    fi
}

# Verify migration
verify_migration() {
    log "Verifying migration..."
    
    # Run a simple query to verify database is accessible
    if docker-compose -f docker-compose.production.yml exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM _prisma_migrations;" > /dev/null; then
        log "Database verification passed"
        return 0
    else
        error "Database verification failed"
        return 1
    fi
}

# Rollback migration
rollback_migration() {
    local backup_file=$1
    
    error "Rolling back migration using backup: $backup_file"
    
    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" > "${backup_file%.gz}"
        backup_file="${backup_file%.gz}"
    fi
    
    # Restore backup
    if docker-compose -f docker-compose.production.yml exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" < "$backup_file"; then
        log "Rollback completed successfully"
    else
        error "Rollback failed! Manual intervention required"
        exit 1
    fi
}

# Main migration process
main() {
    log "Starting database migration process..."
    
    # Load environment variables
    if [ -f .env.production ]; then
        source .env.production
    else
        error ".env.production file not found"
        exit 1
    fi
    
    # Check lock
    check_lock
    
    # Check migration status
    check_migration_status
    
    # Ask for confirmation in production
    if [ "$NODE_ENV" = "production" ]; then
        echo -e "${YELLOW}You are about to run migrations in PRODUCTION.${NC}"
        echo -n "Are you sure you want to continue? (yes/no): "
        read -r confirmation
        
        if [ "$confirmation" != "yes" ]; then
            log "Migration cancelled by user"
            exit 0
        fi
    fi
    
    # Create backup
    BACKUP_FILE=$(create_backup)
    
    # Apply migrations
    if apply_migrations; then
        # Verify migration
        if verify_migration; then
            log "Migration completed successfully!"
            
            # Clean up old backups (keep last 30 days)
            find "$BACKUP_DIR" -name "pre_migration_*.sql.gz" -mtime +30 -delete || true
        else
            # Rollback if verification fails
            rollback_migration "$BACKUP_FILE"
            exit 1
        fi
    else
        # Rollback if migration fails
        rollback_migration "$BACKUP_FILE"
        exit 1
    fi
    
    log "Migration process completed"
}

# Run main function
main "$@"