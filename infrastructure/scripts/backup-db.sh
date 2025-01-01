#!/bin/bash

# SaaS Management Platform - Database Backup Script
# Version: 1.0.0
# Dependencies: aws-cli v2.x, jq v1.6

set -euo pipefail
IFS=$'\n\t'

# Import environment setup functions
source "$(dirname "${BASH_SOURCE[0]}")/setup-env.sh"

# Global Constants
readonly SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
readonly BACKUP_RETENTION_DAYS=30
readonly BACKUP_PREFIX="manual-backup"
readonly LOG_DIR="/var/log/saas-platform/backups"
readonly KMS_KEY_ALIAS="alias/rds-backup-key"
readonly PARALLEL_BACKUP_LIMIT=3
readonly METRIC_NAMESPACE="SaaSPlatform/Backups"
readonly ALERT_SNS_TOPIC="arn:aws:sns:region:account:backup-alerts"

# Logging setup
setup_logging() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local log_file="${LOG_DIR}/backup_${timestamp}.log"
    
    mkdir -p "${LOG_DIR}"
    exec 1> >(tee -a "$log_file")
    exec 2> >(tee -a "$log_file" >&2)
    
    echo "=== Database Backup Log - ${timestamp} ==="
}

# Error handling
error_handler() {
    local line_no=$1
    local error_code=$2
    local last_command="${BASH_COMMAND}"
    
    echo "ERROR: Command '${last_command}' failed with exit code ${error_code} on line ${line_no}"
    
    # Send alert notification
    aws sns publish \
        --topic-arn "${ALERT_SNS_TOPIC}" \
        --message "Backup failure: ${last_command} failed with code ${error_code}" \
        --subject "Database Backup Error"
        
    exit "${error_code}"
}

trap 'error_handler ${LINENO} $?' ERR

# Environment validation
validate_environment() {
    local environment=$1
    local region=$2
    
    echo "Validating environment configuration..."
    
    # Validate AWS credentials and permissions
    if ! aws sts get-caller-identity >/dev/null; then
        echo "ERROR: Invalid AWS credentials"
        return 1
    }
    
    # Verify KMS key access
    if ! aws kms describe-key --key-id "${KMS_KEY_ALIAS}" >/dev/null; then
        echo "ERROR: Cannot access KMS key"
        return 1
    }
    
    # Check SNS topic existence
    if ! aws sns get-topic-attributes --topic-arn "${ALERT_SNS_TOPIC}" >/dev/null; then
        echo "ERROR: Cannot access SNS topic"
        return 1
    }
    
    # Verify CloudWatch log group
    local log_group="/aws/rds/backup/${environment}"
    if ! aws logs describe-log-groups --log-group-name-prefix "${log_group}" >/dev/null; then
        aws logs create-log-group --log-group-name "${log_group}"
    }
    
    return 0
}

# Create RDS snapshot
create_snapshot() {
    local db_instance_identifier=$1
    local snapshot_identifier=$2
    local kms_key_id=$3
    
    echo "Creating snapshot ${snapshot_identifier} for ${db_instance_identifier}..."
    
    # Start snapshot creation
    aws rds create-db-snapshot \
        --db-instance-identifier "${db_instance_identifier}" \
        --db-snapshot-identifier "${snapshot_identifier}" \
        --tags "Key=Environment,Value=${environment}" "Key=CreatedBy,Value=backup-script" \
        || return 1
        
    # Wait for snapshot completion
    aws rds wait db-snapshot-available \
        --db-snapshot-identifier "${snapshot_identifier}"
        
    # Verify encryption
    local snapshot_info
    snapshot_info=$(aws rds describe-db-snapshots \
        --db-snapshot-identifier "${snapshot_identifier}" \
        --query 'DBSnapshots[0]')
    
    local is_encrypted
    is_encrypted=$(echo "${snapshot_info}" | jq -r '.Encrypted')
    
    if [[ "${is_encrypted}" != "true" ]]; then
        echo "ERROR: Snapshot encryption verification failed"
        return 1
    }
    
    # Publish metrics
    local snapshot_size
    snapshot_size=$(echo "${snapshot_info}" | jq -r '.AllocatedStorage')
    
    aws cloudwatch put-metric-data \
        --namespace "${METRIC_NAMESPACE}" \
        --metric-name "SnapshotSize" \
        --value "${snapshot_size}" \
        --dimensions "Environment=${environment},DBInstance=${db_instance_identifier}"
        
    return 0
}

# Cleanup old snapshots
cleanup_old_snapshots() {
    local db_instance_identifier=$1
    local retention_days=$2
    
    echo "Cleaning up old snapshots for ${db_instance_identifier}..."
    
    # Get list of old snapshots
    local cutoff_date
    cutoff_date=$(date -d "${retention_days} days ago" +%Y-%m-%d)
    
    local snapshots_to_delete
    snapshots_to_delete=$(aws rds describe-db-snapshots \
        --db-instance-identifier "${db_instance_identifier}" \
        --query "DBSnapshots[?SnapshotCreateTime<='${cutoff_date}'].[DBSnapshotIdentifier]" \
        --output text)
        
    # Delete old snapshots
    local deleted_count=0
    for snapshot in ${snapshots_to_delete}; do
        echo "Deleting snapshot: ${snapshot}"
        if aws rds delete-db-snapshot --db-snapshot-identifier "${snapshot}"; then
            ((deleted_count++))
        fi
    done
    
    # Publish cleanup metrics
    aws cloudwatch put-metric-data \
        --namespace "${METRIC_NAMESPACE}" \
        --metric-name "DeletedSnapshots" \
        --value "${deleted_count}" \
        --dimensions "Environment=${environment},DBInstance=${db_instance_identifier}"
        
    return 0
}

# Monitor backup status
monitor_backup_status() {
    local snapshot_arn=$1
    local monitoring_config=$2
    
    echo "Monitoring backup status for ${snapshot_arn}..."
    
    # Get snapshot details
    local snapshot_info
    snapshot_info=$(aws rds describe-db-snapshots \
        --db-snapshot-identifier "${snapshot_arn}" \
        --query 'DBSnapshots[0]')
        
    # Monitor progress
    local progress
    progress=$(echo "${snapshot_info}" | jq -r '.PercentProgress')
    
    # Publish monitoring metrics
    aws cloudwatch put-metric-data \
        --namespace "${METRIC_NAMESPACE}" \
        --metric-name "BackupProgress" \
        --value "${progress}" \
        --dimensions "SnapshotARN=${snapshot_arn}"
        
    # Check backup integrity
    local status
    status=$(echo "${snapshot_info}" | jq -r '.Status')
    
    if [[ "${status}" != "available" ]]; then
        echo "ERROR: Snapshot status check failed: ${status}"
        return 1
    }
    
    return 0
}

# Main backup function
backup_database() {
    local environment=$1
    local region=$2
    local db_instance=$3
    
    echo "Starting database backup process..."
    
    # Setup logging
    setup_logging
    
    # Validate environment
    validate_environment "${environment}" "${region}" || exit 1
    
    # Get KMS key ID
    local kms_key_id
    kms_key_id=$(aws kms describe-key --key-id "${KMS_KEY_ALIAS}" --query 'KeyMetadata.KeyId' --output text)
    
    # Generate snapshot identifier
    local timestamp
    timestamp=$(date +%Y-%m-%d-%H-%M-%S)
    local snapshot_identifier="${BACKUP_PREFIX}-${environment}-${timestamp}"
    
    # Create snapshot
    if ! create_snapshot "${db_instance}" "${snapshot_identifier}" "${kms_key_id}"; then
        echo "ERROR: Snapshot creation failed"
        exit 1
    fi
    
    # Monitor backup status
    local monitoring_config="{\"environment\": \"${environment}\", \"metric_namespace\": \"${METRIC_NAMESPACE}\"}"
    if ! monitor_backup_status "${snapshot_identifier}" "${monitoring_config}"; then
        echo "ERROR: Backup monitoring failed"
        exit 1
    fi
    
    # Cleanup old snapshots
    if ! cleanup_old_snapshots "${db_instance}" "${BACKUP_RETENTION_DAYS}"; then
        echo "WARNING: Snapshot cleanup failed"
    fi
    
    echo "Database backup completed successfully"
    return 0
}

# Script execution
if [[ "${#}" -ne 3 ]]; then
    echo "Usage: $0 <environment> <region> <db_instance_identifier>"
    echo "Example: $0 production us-east-1 saas-platform-db"
    exit 1
fi

backup_database "$1" "$2" "$3"