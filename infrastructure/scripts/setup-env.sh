#!/bin/bash

# SaaS Management Platform - Environment Setup Script
# Version: 1.0.0
# Required: aws-cli v2.x, terraform v1.5.x

set -euo pipefail
IFS=$'\n\t'

# Global Constants
readonly SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
readonly ENVIRONMENTS=("development" "staging" "production")
readonly BACKEND_DIR="../../src/backend"
readonly FRONTEND_DIR="../../src/web"
readonly TERRAFORM_DIR="../terraform/environments"
readonly LOG_DIR="../logs"
readonly BACKUP_DIR="../backups"
readonly REQUIRED_AWS_VERSION="2.0.0"
readonly REQUIRED_TERRAFORM_VERSION="1.5.0"

# Logging Configuration
setup_logging() {
    local environment=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local log_file="${LOG_DIR}/${environment}_setup_${timestamp}.log"
    
    mkdir -p "${LOG_DIR}"
    exec 1> >(tee -a "$log_file")
    exec 2> >(tee -a "$log_file" >&2)
    
    echo "=== Environment Setup Log - ${environment} - ${timestamp} ==="
}

# Error Handling
error_handler() {
    local line_no=$1
    local error_code=$2
    local last_command="${BASH_COMMAND}"
    
    echo "ERROR: Command '${last_command}' failed with exit code ${error_code} on line ${line_no}"
    
    # Perform cleanup
    cleanup_on_error
    
    exit "${error_code}"
}

trap 'error_handler ${LINENO} $?' ERR

cleanup_on_error() {
    echo "Performing cleanup after error..."
    # Restore backups if they exist
    if [[ -d "${BACKUP_DIR}/latest" ]]; then
        cp -r "${BACKUP_DIR}/latest"/* ./
    fi
}

# Version Validation
validate_version() {
    local current=$1
    local required=$2
    
    if [[ "$(printf '%s\n' "$required" "$current" | sort -V | head -n1)" != "$required" ]]; then
        echo "ERROR: Version $current is less than required version $required"
        return 1
    fi
}

# Environment Validation
validate_environment() {
    local environment=$1
    
    echo "Validating environment: ${environment}"
    
    # Check if environment is valid
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        echo "ERROR: Invalid environment '${environment}'. Must be one of: ${ENVIRONMENTS[*]}"
        return 1
    }
    
    # Validate required directories
    local required_dirs=("${BACKEND_DIR}" "${FRONTEND_DIR}" "${TERRAFORM_DIR}")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            echo "ERROR: Required directory '$dir' not found"
            return 1
        fi
    done
    
    # Validate AWS CLI installation and version
    if ! aws_version=$(aws --version 2>&1 | grep -oP "aws-cli/\K[0-9]+\.[0-9]+\.[0-9]+"); then
        echo "ERROR: AWS CLI not found or version check failed"
        return 1
    fi
    validate_version "$aws_version" "$REQUIRED_AWS_VERSION"
    
    # Validate Terraform installation and version
    if ! terraform_version=$(terraform version -json | jq -r '.terraform_version'); then
        echo "ERROR: Terraform not found or version check failed"
        return 1
    fi
    validate_version "$terraform_version" "$REQUIRED_TERRAFORM_VERSION"
    
    echo "Environment validation successful"
    return 0
}

# AWS Credentials Setup
setup_aws_credentials() {
    local environment=$1
    
    echo "Setting up AWS credentials for ${environment}"
    
    # Create AWS credentials backup
    mkdir -p "${BACKUP_DIR}/aws"
    if [[ -f ~/.aws/credentials ]]; then
        cp ~/.aws/credentials "${BACKUP_DIR}/aws/credentials_$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Load environment-specific AWS credentials
    local aws_config_file="${SCRIPT_DIR}/config/aws/${environment}.json"
    if [[ ! -f "$aws_config_file" ]]; then
        echo "ERROR: AWS configuration file not found: $aws_config_file"
        return 1
    fi
    
    # Configure AWS CLI profile
    aws configure set aws_access_key_id $(jq -r .aws_access_key_id "$aws_config_file") --profile "$environment"
    aws configure set aws_secret_access_key $(jq -r .aws_secret_access_key "$aws_config_file") --profile "$environment"
    aws configure set region $(jq -r .aws_region "$aws_config_file") --profile "$environment"
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity --profile "$environment" >/dev/null 2>&1; then
        echo "ERROR: AWS credentials verification failed"
        return 1
    fi
    
    echo "AWS credentials setup successful"
    return 0
}

# Backend Environment Setup
setup_backend_env() {
    local environment=$1
    
    echo "Setting up backend environment for ${environment}"
    
    # Create backup of existing configuration
    mkdir -p "${BACKUP_DIR}/backend"
    if [[ -f "${BACKEND_DIR}/.env" ]]; then
        cp "${BACKEND_DIR}/.env" "${BACKUP_DIR}/backend/.env_$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Generate secure random values
    local jwt_secret=$(openssl rand -hex 32)
    local encryption_key=$(openssl rand -hex 32)
    
    # Create environment file from template
    cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    
    # Configure environment variables
    sed -i "s|NODE_ENV=.*|NODE_ENV=${environment}|g" "${BACKEND_DIR}/.env"
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|g" "${BACKEND_DIR}/.env"
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${encryption_key}|g" "${BACKEND_DIR}/.env"
    
    echo "Backend environment setup successful"
    return 0
}

# Frontend Environment Setup
setup_frontend_env() {
    local environment=$1
    
    echo "Setting up frontend environment for ${environment}"
    
    # Create backup of existing configuration
    mkdir -p "${BACKUP_DIR}/frontend"
    if [[ -f "${FRONTEND_DIR}/src/environments/environment.ts" ]]; then
        cp "${FRONTEND_DIR}/src/environments/environment.ts" \
           "${BACKUP_DIR}/frontend/environment_$(date +%Y%m%d_%H%M%S).ts"
    fi
    
    # Generate environment-specific configuration
    local api_url
    case "$environment" in
        development)
            api_url="http://localhost:3000"
            ;;
        staging)
            api_url="https://api.staging.saasplatform.com"
            ;;
        production)
            api_url="https://api.saasplatform.com"
            ;;
    esac
    
    # Create environment configuration
    cat > "${FRONTEND_DIR}/src/environments/environment.ts" <<EOF
export const environment = {
    production: ${environment == "production"},
    apiUrl: '${api_url}',
    version: '${environment}-$(date +%Y%m%d)',
    features: {
        aiAssistant: ${environment != "development"},
        analytics: true,
        multiLanguage: false
    }
};
EOF
    
    echo "Frontend environment setup successful"
    return 0
}

# Terraform Workspace Setup
setup_terraform_workspace() {
    local environment=$1
    
    echo "Setting up Terraform workspace for ${environment}"
    
    # Create backup of existing state
    mkdir -p "${BACKUP_DIR}/terraform"
    if [[ -d "${TERRAFORM_DIR}/${environment}/.terraform" ]]; then
        cp -r "${TERRAFORM_DIR}/${environment}/.terraform" \
              "${BACKUP_DIR}/terraform/.terraform_${environment}_$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Initialize Terraform
    cd "${TERRAFORM_DIR}/${environment}"
    
    # Initialize and select workspace
    terraform init
    
    # Create or select workspace
    if ! terraform workspace select "$environment" 2>/dev/null; then
        terraform workspace new "$environment"
    fi
    
    # Validate Terraform configuration
    if ! terraform validate; then
        echo "ERROR: Terraform configuration validation failed"
        return 1
    fi
    
    echo "Terraform workspace setup successful"
    return 0
}

# Main Setup Function
main() {
    local environment=$1
    
    echo "Starting environment setup for: ${environment}"
    
    # Setup logging
    setup_logging "$environment"
    
    # Run setup steps
    validate_environment "$environment" || exit 1
    setup_aws_credentials "$environment" || exit 1
    setup_backend_env "$environment" || exit 1
    setup_frontend_env "$environment" || exit 1
    setup_terraform_workspace "$environment" || exit 1
    
    echo "Environment setup completed successfully for: ${environment}"
    return 0
}

# Script execution
if [[ "${#}" -ne 1 ]]; then
    echo "Usage: $0 <environment>"
    echo "Available environments: ${ENVIRONMENTS[*]}"
    exit 1
fi

main "$1"