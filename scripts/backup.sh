#!/bin/bash

# Comprehensive Backup Script for BugBase
# Backs up database, uploads, and configuration files

set -e

# Configuration
BACKUP_ROOT="/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
S3_BUCKET=${S3_BUCKET:-""}
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-""}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
LOG_FILE="$BACKUP_ROOT/backup.log"

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

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
}

# Backup database
backup_database() {
    log "Starting database backup..."
    
    DB_BACKUP_FILE="$BACKUP_DIR/database.sql"
    
    # Use docker-compose to backup database
    if docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T postgres \
        pg_dump -U "$DB_USER" "$DB_NAME" --verbose --no-owner --no-acl > "$DB_BACKUP_FILE"; then
        
        # Compress the backup
        gzip -9 "$DB_BACKUP_FILE"
        DB_BACKUP_FILE="$DB_BACKUP_FILE.gz"
        
        log "Database backup completed: $(du -h "$DB_BACKUP_FILE" | cut -f1)"
    else
        error "Database backup failed"
    fi
}

# Backup uploads directory
backup_uploads() {
    log "Starting uploads backup..."
    
    UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads.tar.gz"
    
    # Get uploads volume path
    UPLOADS_PATH=$(docker volume inspect bugbase_uploads --format '{{ .Mountpoint }}')
    
    if [ -d "$UPLOADS_PATH" ]; then
        tar -czf "$UPLOADS_BACKUP_FILE" -C "$UPLOADS_PATH" .
        log "Uploads backup completed: $(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)"
    else
        warning "Uploads directory not found"
    fi
}

# Backup configuration files
backup_configs() {
    log "Starting configuration backup..."
    
    CONFIG_BACKUP_FILE="$BACKUP_DIR/configs.tar.gz"
    
    # List of configuration files to backup
    CONFIG_FILES=(
        "/opt/bugbase/.env.production"
        "/opt/bugbase/docker-compose.production.yml"
        "/opt/bugbase/nginx-lb.conf"
        "/etc/nginx/ssl"
        "/etc/letsencrypt"
    )
    
    # Create temporary directory for configs
    TEMP_CONFIG_DIR="$BACKUP_DIR/configs"
    mkdir -p "$TEMP_CONFIG_DIR"
    
    # Copy configuration files
    for file in "${CONFIG_FILES[@]}"; do
        if [ -e "$file" ]; then
            cp -r "$file" "$TEMP_CONFIG_DIR/" 2>/dev/null || true
        fi
    done
    
    # Create tar archive
    tar -czf "$CONFIG_BACKUP_FILE" -C "$TEMP_CONFIG_DIR" .
    rm -rf "$TEMP_CONFIG_DIR"
    
    log "Configuration backup completed: $(du -h "$CONFIG_BACKUP_FILE" | cut -f1)"
}

# Backup Redis data
backup_redis() {
    log "Starting Redis backup..."
    
    REDIS_BACKUP_FILE="$BACKUP_DIR/redis.rdb"
    
    # Trigger Redis BGSAVE
    docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T redis \
        redis-cli --pass "$REDIS_PASSWORD" BGSAVE
    
    # Wait for backup to complete
    sleep 5
    
    # Copy Redis dump file
    REDIS_PATH=$(docker volume inspect bugbase_redis_data --format '{{ .Mountpoint }}')
    if [ -f "$REDIS_PATH/dump.rdb" ]; then
        cp "$REDIS_PATH/dump.rdb" "$REDIS_BACKUP_FILE"
        gzip -9 "$REDIS_BACKUP_FILE"
        log "Redis backup completed: $(du -h "$REDIS_BACKUP_FILE.gz" | cut -f1)"
    else
        warning "Redis dump file not found"
    fi
}

# Create backup manifest
create_manifest() {
    log "Creating backup manifest..."
    
    cat > "$BACKUP_DIR/manifest.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "version": "$(docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T backend cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')",
    "files": [
        "database.sql.gz",
        "uploads.tar.gz",
        "configs.tar.gz",
        "redis.rdb.gz"
    ],
    "metadata": {
        "hostname": "$(hostname)",
        "backup_size": "$(du -sh $BACKUP_DIR | cut -f1)",
        "database_size": "$(docker-compose -f /opt/bugbase/docker-compose.production.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'))" | tr -d '[:space:]')"
    }
}
EOF
}

# Encrypt backup if encryption key is provided
encrypt_backup() {
    if [ -n "$ENCRYPTION_KEY" ]; then
        log "Encrypting backup..."
        
        # Create tar of entire backup directory
        BACKUP_TAR="$BACKUP_ROOT/bugbase_backup_$TIMESTAMP.tar"
        tar -cf "$BACKUP_TAR" -C "$BACKUP_ROOT" "$TIMESTAMP"
        
        # Encrypt the tar file
        openssl enc -aes-256-cbc -salt -in "$BACKUP_TAR" -out "$BACKUP_TAR.enc" -k "$ENCRYPTION_KEY"
        
        # Remove unencrypted files
        rm -rf "$BACKUP_DIR"
        rm "$BACKUP_TAR"
        
        FINAL_BACKUP="$BACKUP_TAR.enc"
        log "Backup encrypted successfully"
    else
        # Create tar of backup directory
        FINAL_BACKUP="$BACKUP_ROOT/bugbase_backup_$TIMESTAMP.tar.gz"
        tar -czf "$FINAL_BACKUP" -C "$BACKUP_ROOT" "$TIMESTAMP"
        rm -rf "$BACKUP_DIR"
    fi
}

# Upload to S3
upload_to_s3() {
    if [ -n "$S3_BUCKET" ]; then
        log "Uploading backup to S3..."
        
        if aws s3 cp "$FINAL_BACKUP" "s3://$S3_BUCKET/backups/" --storage-class GLACIER_IR; then
            log "Backup uploaded to S3 successfully"
            
            # Remove local backup after successful upload
            rm "$FINAL_BACKUP"
        else
            error "Failed to upload backup to S3"
        fi
    else
        log "S3 bucket not configured, keeping backup locally"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Local cleanup
    find "$BACKUP_ROOT" -name "bugbase_backup_*.tar*" -mtime +$RETENTION_DAYS -delete
    
    # S3 cleanup if configured
    if [ -n "$S3_BUCKET" ]; then
        # List and delete old backups from S3
        aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
            createDate=$(echo "$line" | awk '{print $1" "$2}')
            createDate=$(date -d "$createDate" +%s)
            olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
            
            if [[ $createDate -lt $olderThan ]]; then
                fileName=$(echo "$line" | awk '{print $4}')
                if [ -n "$fileName" ]; then
                    aws s3 rm "s3://$S3_BUCKET/backups/$fileName"
                    log "Deleted old backup from S3: $fileName"
                fi
            fi
        done
    fi
}

# Verify backup
verify_backup() {
    log "Verifying backup..."
    
    if [ -f "$FINAL_BACKUP" ]; then
        # Test archive integrity
        if [ "${FINAL_BACKUP##*.}" = "enc" ]; then
            # For encrypted backups, just check file size
            if [ -s "$FINAL_BACKUP" ]; then
                log "Encrypted backup verified (size: $(du -h "$FINAL_BACKUP" | cut -f1))"
            else
                error "Backup file is empty"
            fi
        else
            # For unencrypted backups, test tar integrity
            if tar -tzf "$FINAL_BACKUP" >/dev/null 2>&1; then
                log "Backup archive verified successfully"
            else
                error "Backup archive is corrupted"
            fi
        fi
    else
        error "Backup file not found"
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    # Send email notification if configured
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "BugBase Backup $status" "$NOTIFICATION_EMAIL"
    fi
    
    # Send Slack notification if configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"BugBase Backup $status: $message\"}" \
            "$SLACK_WEBHOOK"
    fi
}

# Main backup process
main() {
    log "Starting BugBase backup process..."
    
    # Load environment variables
    if [ -f /opt/bugbase/.env.production ]; then
        source /opt/bugbase/.env.production
    fi
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_database
    backup_uploads
    backup_configs
    backup_redis
    
    # Create manifest
    create_manifest
    
    # Encrypt backup
    encrypt_backup
    
    # Verify backup
    verify_backup
    
    # Upload to S3
    upload_to_s3
    
    # Clean old backups
    cleanup_old_backups
    
    log "Backup completed successfully!"
    send_notification "SUCCESS" "Backup completed at $(date)"
}

# Error handling
trap 'error "Backup failed at line $LINENO"' ERR

# Run main function
main "$@"