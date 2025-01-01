#!/bin/bash

# SaaS Management Platform - Key Rotation Script
# Version: 1.0.0
# Dependencies: aws-cli v2.x, jq v1.6

set -euo pipefail
IFS=$'\n\t'

# Source environment configuration
source "$(dirname "${BASH_SOURCE[0]}")/setup-env.sh"

# Global Constants
readonly SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
readonly LOG_FILE="/var/log/key-rotation.log"
readonly ROTATION_HISTORY="/var/log/rotation-history.json"
readonly MAX_RETRIES=5
readonly BACKOFF_BASE=2

# Logging setup
setup_logging() {
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    local log_dir=$(dirname "$LOG_FILE")
    
    # Ensure log directory exists with proper permissions
    if [[ ! -d "$log_dir" ]]; then
        sudo mkdir -p "$log_dir"
        sudo chmod 750 "$log_dir"
    fi
    
    # Initialize rotation history if it doesn't exist
    if [[ ! -f "$ROTATION_HISTORY" ]]; then
        echo '{"rotations":[]}' | sudo tee "$ROTATION_HISTORY" > /dev/null
        sudo chmod 640 "$ROTATION_HISTORY"
    fi
    
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
    
    echo "=== Key Rotation Started at ${timestamp} ==="
}

# Validate prerequisites for rotation
validate_prerequisites() {
    local service_type=$1
    
    echo "Validating prerequisites for ${service_type} rotation..."
    
    # Check AWS CLI version
    local aws_version
    aws_version=$(aws --version 2>&1 | grep -oP "aws-cli/\K[0-9]+\.[0-9]+\.[0-9]+")
    if [[ -z "$aws_version" ]]; then
        echo "ERROR: AWS CLI not found"
        return 1
    fi
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        echo "ERROR: Invalid AWS credentials"
        return 1
    }
    
    # Service-specific validations
    case "$service_type" in
        "kms")
            aws kms list-keys --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null
            ;;
        "rds")
            aws rds describe-db-instances --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null
            ;;
        "api")
            aws apigateway get-rest-apis --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null
            ;;
        *)
            echo "ERROR: Unknown service type: ${service_type}"
            return 1
            ;;
    esac
    
    return 0
}

# Rotate KMS keys
rotate_kms_keys() {
    local key_id=$1
    local region=$2
    
    echo "Starting KMS key rotation for key ${key_id}..."
    
    # Create pre-rotation snapshot
    local snapshot_id
    snapshot_id=$(aws kms create-key --profile "$AWS_PROFILE" --region "$region" \
        --description "Backup key for ${key_id}" --query 'KeyMetadata.KeyId' --output text)
    
    # Enable automatic key rotation
    aws kms enable-key-rotation --profile "$AWS_PROFILE" --region "$region" --key-id "$key_id"
    
    # Trigger manual rotation if needed
    aws kms update-key-description --profile "$AWS_PROFILE" --region "$region" \
        --key-id "$key_id" --description "Rotated on $(date -u +"%Y-%m-%d")"
    
    # Update rotation history
    local rotation_entry
    rotation_entry=$(jq -n \
        --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --arg key_id "$key_id" \
        --arg type "kms" \
        --arg status "success" \
        '{timestamp: $timestamp, type: $type, key_id: $key_id, status: $status}')
    
    sudo jq --arg entry "$rotation_entry" '.rotations += [$entry|fromjson]' "$ROTATION_HISTORY" > "${ROTATION_HISTORY}.tmp"
    sudo mv "${ROTATION_HISTORY}.tmp" "$ROTATION_HISTORY"
    
    return 0
}

# Rotate RDS credentials
rotate_rds_credentials() {
    local db_instance_identifier=$1
    local region=$2
    
    echo "Starting RDS credential rotation for instance ${db_instance_identifier}..."
    
    # Generate secure password
    local new_password
    new_password=$(openssl rand -base64 32)
    
    # Create temporary access credentials
    local temp_user="rotation_$(date +%s)"
    aws rds create-db-instance-read-replica --profile "$AWS_PROFILE" --region "$region" \
        --db-instance-identifier "${db_instance_identifier}-temp" \
        --source-db-instance-identifier "$db_instance_identifier"
    
    # Update master credentials
    aws rds modify-db-instance --profile "$AWS_PROFILE" --region "$region" \
        --db-instance-identifier "$db_instance_identifier" \
        --master-user-password "$new_password" \
        --apply-immediately
    
    # Wait for modification to complete
    aws rds wait db-instance-available --profile "$AWS_PROFILE" --region "$region" \
        --db-instance-identifier "$db_instance_identifier"
    
    # Update rotation history
    local rotation_entry
    rotation_entry=$(jq -n \
        --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --arg instance_id "$db_instance_identifier" \
        --arg type "rds" \
        --arg status "success" \
        '{timestamp: $timestamp, type: $type, instance_id: $instance_id, status: $status}')
    
    sudo jq --arg entry "$rotation_entry" '.rotations += [$entry|fromjson]' "$ROTATION_HISTORY" > "${ROTATION_HISTORY}.tmp"
    sudo mv "${ROTATION_HISTORY}.tmp" "$ROTATION_HISTORY"
    
    return 0
}

# Rotate API keys
rotate_api_keys() {
    local api_id=$1
    local stage=$2
    
    echo "Starting API key rotation for API ${api_id} stage ${stage}..."
    
    # Create new API key
    local new_key_id
    new_key_id=$(aws apigateway create-api-key --profile "$AWS_PROFILE" --region "$AWS_REGION" \
        --name "key-$(date +%s)" --enabled --query 'id' --output text)
    
    # Create usage plan if it doesn't exist
    local usage_plan_id
    usage_plan_id=$(aws apigateway create-usage-plan --profile "$AWS_PROFILE" --region "$AWS_REGION" \
        --name "plan-$(date +%s)" --api-stages "apiId=${api_id},stage=${stage}" \
        --query 'id' --output text)
    
    # Associate new key with usage plan
    aws apigateway create-usage-plan-key --profile "$AWS_PROFILE" --region "$AWS_REGION" \
        --usage-plan-id "$usage_plan_id" --key-id "$new_key_id" --key-type "API_KEY"
    
    # Update rotation history
    local rotation_entry
    rotation_entry=$(jq -n \
        --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --arg api_id "$api_id" \
        --arg type "api" \
        --arg status "success" \
        '{timestamp: $timestamp, type: $type, api_id: $api_id, status: $status}')
    
    sudo jq --arg entry "$rotation_entry" '.rotations += [$entry|fromjson]' "$ROTATION_HISTORY" > "${ROTATION_HISTORY}.tmp"
    sudo mv "${ROTATION_HISTORY}.tmp" "$ROTATION_HISTORY"
    
    return 0
}

# Handle rotation failures
handle_rotation_failure() {
    local service_name=$1
    local error_code=$2
    local attempt_number=$3
    
    echo "Handling rotation failure for ${service_name} (attempt ${attempt_number})"
    
    # Calculate backoff interval
    local wait_time=$((BACKOFF_BASE ** attempt_number))
    
    # Log failure
    local failure_entry
    failure_entry=$(jq -n \
        --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --arg service "$service_name" \
        --arg error "$error_code" \
        --arg attempt "$attempt_number" \
        '{timestamp: $timestamp, service: $service, error: $error, attempt: $attempt}')
    
    sudo jq --arg entry "$failure_entry" '.failures += [$entry|fromjson]' "$ROTATION_HISTORY" > "${ROTATION_HISTORY}.tmp"
    sudo mv "${ROTATION_HISTORY}.tmp" "$ROTATION_HISTORY"
    
    # Send alert if max retries reached
    if [[ $attempt_number -ge $MAX_RETRIES ]]; then
        aws sns publish --profile "$AWS_PROFILE" --region "$AWS_REGION" \
            --topic-arn "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:key-rotation-alerts" \
            --message "Key rotation failed for ${service_name} after ${MAX_RETRIES} attempts"
        return 1
    fi
    
    return $wait_time
}

# Main execution
main() {
    setup_logging
    
    echo "Starting key rotation process..."
    
    # Rotate KMS keys
    if validate_prerequisites "kms"; then
        aws kms list-keys --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'Keys[].KeyId' --output text | \
        while read -r key_id; do
            if ! rotate_kms_keys "$key_id" "$AWS_REGION"; then
                handle_rotation_failure "kms" "ERR_KMS_ROTATION" 1
            fi
        done
    fi
    
    # Rotate RDS credentials
    if validate_prerequisites "rds"; then
        aws rds describe-db-instances --profile "$AWS_PROFILE" --region "$AWS_REGION" \
            --query 'DBInstances[].DBInstanceIdentifier' --output text | \
        while read -r instance_id; do
            if ! rotate_rds_credentials "$instance_id" "$AWS_REGION"; then
                handle_rotation_failure "rds" "ERR_RDS_CREDENTIALS" 1
            fi
        done
    fi
    
    # Rotate API keys
    if validate_prerequisites "api"; then
        aws apigateway get-rest-apis --profile "$AWS_PROFILE" --region "$AWS_REGION" \
            --query 'items[].id' --output text | \
        while read -r api_id; do
            aws apigateway get-stages --profile "$AWS_PROFILE" --region "$AWS_REGION" \
                --rest-api-id "$api_id" --query 'item[].stageName' --output text | \
            while read -r stage; do
                if ! rotate_api_keys "$api_id" "$stage"; then
                    handle_rotation_failure "api" "ERR_API_KEY" 1
                fi
            done
        done
    fi
    
    echo "Key rotation process completed"
    return 0
}

# Execute main function
main "$@"