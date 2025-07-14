#!/bin/bash

# Disaster Recovery Script for BugBase
# Restores database, uploads, and configuration from backup

set -e

# Configuration
BACKUP_ROOT="/backup"
RESTORE_POINT=""
S3_BUCKET=${S3_BUCKET:-""}
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-""}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
LOG_FILE="$BACKUP_ROOT/restore.log"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# List available backups
list_backups() {
    log "Available backups:"
    echo ""
    
    # Local backups
    echo "Local backups:"
    ls -la "$BACKUP_ROOT"/bugbase_backup_*.tar* 2>/dev/null | awk '{print $9}' | sed 's/.*bugbase_backup_//' | sed 's/.tar.*//' || echo "No local backups found"
    
    echo ""
    
    # S3 backups
    if [ -n "$S3_BUCKET" ]; then
        echo "S3 backups:"
        aws s3 ls "s3://$S3_BUCKET/backups/" | grep bugbase_backup | awk '{print $4}' | sed 's/bugbase_backup_//' | sed 's/.tar.*//'
    fi
}

# Download backup from S3
download_from_s3() {
    local backup_name=$1
    
    log "Downloading backup from S3..."
    
    if aws s3 cp "s3://$S3_BUCKET/backups/$backup_name" "$BACKUP_ROOT/"; then
        log "Backup downloaded successfully"
        return 0
    else
        error "Failed to download backup from S3"
    fi
}

# Decrypt backup
decrypt_backup() {
    local encrypted_file=$1
    local decrypted_file="${encrypted_file%.enc}"
    
    if [ -n "$ENCRYPTION_KEY" ] && [[ "$encrypted_file" == *.enc ]]; then
        log "Decrypting backup..."
        
        openssl enc -aes-256-cbc -d -in "$encrypted_file" -out "$decrypted_file" -k "$ENCRYPTION_KEY"
        
        if [ $? -eq 0 ]; then
            rm "$encrypted_file"
            echo "$decrypted_file"
        else
            error "Failed to decrypt backup"
        fi
    else
        echo "$encrypted_file"
    fi
}

# Extract backup
extract_backup() {
    local backup_file=$1
    local extract_dir="$BACKUP_ROOT/restore_temp"
    
    log "Extracting backup..."
    
    rm -rf "$extract_dir"
    mkdir -p "$extract_dir"
    
    if tar -xf "$backup_file" -C "$extract_dir"; then
        # Find the actual backup directory
        BACKUP_DIR=$(find "$extract_dir" -maxdepth 1 -type d -name "[0-9]*_[0-9]*" | head -1)
        
        if [ -z "$BACKUP_DIR" ]; then
            error "Invalid backup structure"
        fi
        
        log "Backup extracted to: $BACKUP_DIR"
    else
        error "Failed to extract backup"
    fi
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    cd /opt/bugbase
    docker-compose -f docker-compose.production.yml stop backend frontend
    
    log "Services stopped"
}

# Start services
start_services() {
    log "Starting services..."
    
    cd /opt/bugbase
    docker-compose -f docker-compose.production.yml start backend frontend
    
    log "Services started"
}

# Restore database
restore_database() {
    log "Restoring database..."
    
    local db_backup="$BACKUP_DIR/database.sql.gz"
    
    if [ ! -f "$db_backup" ]; then
        error "Database backup not found"
    fi
    
    # Create new database backup before restore
    log "Creating pre-restore backup..."
    docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T postgres \
        pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_ROOT/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
    
    # Drop and recreate database
    log "Recreating database..."
    docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T postgres \
        psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T postgres \
        psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
    
    # Restore database
    log "Importing database backup..."
    gunzip -c "$db_backup" | docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME"
    
    if [ $? -eq 0 ]; then
        log "Database restored successfully"
    else
        error "Database restore failed"
    fi
}

# Restore uploads
restore_uploads() {
    log "Restoring uploads..."
    
    local uploads_backup="$BACKUP_DIR/uploads.tar.gz"
    
    if [ ! -f "$uploads_backup" ]; then
        warning "Uploads backup not found, skipping"
        return
    fi
    
    # Get uploads volume path
    UPLOADS_PATH=$(docker volume inspect bugbase_uploads --format '{{ .Mountpoint }}')
    
    # Backup current uploads
    if [ -d "$UPLOADS_PATH" ]; then
        log "Backing up current uploads..."
        tar -czf "$BACKUP_ROOT/uploads_pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz" -C "$UPLOADS_PATH" .
    fi
    
    # Clear uploads directory
    rm -rf "$UPLOADS_PATH"/*
    
    # Extract uploads
    tar -xzf "$uploads_backup" -C "$UPLOADS_PATH"
    
    log "Uploads restored successfully"
}

# Restore Redis
restore_redis() {
    log "Restoring Redis data..."
    
    local redis_backup="$BACKUP_DIR/redis.rdb.gz"
    
    if [ ! -f "$redis_backup" ]; then
        warning "Redis backup not found, skipping"
        return
    fi
    
    # Get Redis volume path
    REDIS_PATH=$(docker volume inspect bugbase_redis_data --format '{{ .Mountpoint }}')
    
    # Stop Redis
    docker-compose -f /opt/bugbase/docker-compose.production.yml stop redis
    
    # Backup current Redis data
    if [ -f "$REDIS_PATH/dump.rdb" ]; then
        cp "$REDIS_PATH/dump.rdb" "$BACKUP_ROOT/redis_pre_restore_$(date +%Y%m%d_%H%M%S).rdb"
    fi
    
    # Restore Redis dump
    gunzip -c "$redis_backup" > "$REDIS_PATH/dump.rdb"
    
    # Start Redis
    docker-compose -f /opt/bugbase/docker-compose.production.yml start redis
    
    log "Redis data restored successfully"
}

# Verify restoration
verify_restoration() {
    log "Verifying restoration..."
    
    # Check database connection
    if docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM users;" >/dev/null 2>&1; then
        log "Database verification: OK"
    else
        error "Database verification failed"
    fi
    
    # Check application health
    sleep 30  # Wait for services to fully start
    
    if curl -f http://localhost/api/health/ready >/dev/null 2>&1; then
        log "Application health check: OK"
    else
        warning "Application health check failed"
    fi
}

# Main restore process
main() {
    log "Starting BugBase disaster recovery process..."
    
    # Load environment variables
    if [ -f /opt/bugbase/.env.production ]; then
        source /opt/bugbase/.env.production
    else
        error ".env.production file not found"
    fi
    
    # Check if restore point specified
    if [ -z "$RESTORE_POINT" ]; then
        list_backups
        echo ""
        echo -n "Enter the backup timestamp to restore (YYYYMMDD_HHMMSS): "
        read RESTORE_POINT
    fi
    
    # Validate restore point
    if [ -z "$RESTORE_POINT" ]; then
        error "No restore point specified"
    fi
    
    # Find backup file
    BACKUP_FILE=""
    
    # Check local first
    for ext in ".tar.gz" ".tar" ".tar.enc"; do
        if [ -f "$BACKUP_ROOT/bugbase_backup_$RESTORE_POINT$ext" ]; then
            BACKUP_FILE="$BACKUP_ROOT/bugbase_backup_$RESTORE_POINT$ext"
            break
        fi
    done
    
    # If not found locally and S3 is configured, try S3
    if [ -z "$BACKUP_FILE" ] && [ -n "$S3_BUCKET" ]; then
        for ext in ".tar.gz" ".tar" ".tar.enc"; do
            if aws s3 ls "s3://$S3_BUCKET/backups/bugbase_backup_$RESTORE_POINT$ext" >/dev/null 2>&1; then
                download_from_s3 "bugbase_backup_$RESTORE_POINT$ext"
                BACKUP_FILE="$BACKUP_ROOT/bugbase_backup_$RESTORE_POINT$ext"
                break
            fi
        done
    fi
    
    if [ -z "$BACKUP_FILE" ]; then
        error "Backup not found: $RESTORE_POINT"
    fi
    
    log "Found backup: $BACKUP_FILE"
    
    # Confirmation
    echo -e "${YELLOW}WARNING: This will restore the system to the state at $RESTORE_POINT${NC}"
    echo -e "${YELLOW}All current data will be backed up but replaced.${NC}"
    echo -n "Are you sure you want to continue? (yes/no): "
    read confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
    
    # Decrypt if needed
    BACKUP_FILE=$(decrypt_backup "$BACKUP_FILE")
    
    # Extract backup
    extract_backup "$BACKUP_FILE"
    
    # Stop services
    stop_services
    
    # Restore components
    restore_database
    restore_uploads
    restore_redis
    
    # Start services
    start_services
    
    # Verify restoration
    verify_restoration
    
    # Cleanup
    rm -rf "$BACKUP_ROOT/restore_temp"
    
    log "Disaster recovery completed successfully!"
    log "The system has been restored to: $RESTORE_POINT"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--timestamp)
            RESTORE_POINT="$2"
            shift 2
            ;;
        -l|--list)
            list_backups
            exit 0
            ;;
        -h|--help)
            echo "Usage: $0 [-t|--timestamp TIMESTAMP] [-l|--list]"
            echo "  -t, --timestamp    Specify backup timestamp to restore"
            echo "  -l, --list         List available backups"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@"