#!/bin/bash

# SaaS Management Platform - Deployment Script
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.x
# - terraform v1.5.x
# - docker v24.x

set -euo pipefail
IFS=$'\n\t'

# Import environment setup functions
source "$(dirname "${BASH_SOURCE[0]}")/setup-env.sh"

# Global Constants
readonly SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
readonly ENVIRONMENTS=("development" "staging" "production")
readonly TERRAFORM_DIR="../terraform/environments"
readonly DOCKER_COMPOSE_FILE="../docker/monitoring/docker-compose.yml"
readonly DEPLOYMENT_LOG="/var/log/saas-platform/deployments.log"
readonly HEALTH_CHECK_RETRIES=5
readonly ROLLBACK_TIMEOUT=300

# Logging Configuration
setup_deployment_logging() {
    local environment=$1
    local deployment_id=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p "$(dirname "${DEPLOYMENT_LOG}")"
    exec 1> >(tee -a "${DEPLOYMENT_LOG}")
    exec 2> >(tee -a "${DEPLOYMENT_LOG}" >&2)
    
    echo "=== Deployment Started - ${environment} - ${deployment_id} ==="
    echo "Deployment ID: ${deployment_id}"
    
    echo "${deployment_id}"
}

# Error Handling
deployment_error_handler() {
    local line_no=$1
    local error_code=$2
    local deployment_id=$3
    local environment=$4
    
    echo "ERROR: Command '${BASH_COMMAND}' failed with exit code ${error_code} on line ${line_no}"
    handle_rollback "${environment}" "${deployment_id}"
    
    exit "${error_code}"
}

validate_deployment() {
    local environment=$1
    
    echo "Validating deployment prerequisites for ${environment}"
    
    # Validate environment
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        echo "ERROR: Invalid environment '${environment}'"
        return 1
    }
    
    # Validate AWS credentials and permissions
    if ! validate_credentials "${environment}"; then
        echo "ERROR: AWS credentials validation failed"
        return 1
    }
    
    # Verify Docker registry authentication
    if ! aws ecr get-login-password --region $(aws configure get region) | \
        docker login --username AWS --password-stdin \
        "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com"; then
        echo "ERROR: Docker registry authentication failed"
        return 1
    }
    
    # Validate Terraform configuration
    if ! terraform -chdir="${TERRAFORM_DIR}/${environment}" validate; then
        echo "ERROR: Terraform configuration validation failed"
        return 1
    }
    
    # Check SSL certificates
    if [[ "${environment}" != "development" ]]; then
        local domain
        case "${environment}" in
            staging) domain="staging.saasplatform.com" ;;
            production) domain="saasplatform.com" ;;
        esac
        if ! openssl s_client -connect "${domain}":443 -servername "${domain}" </dev/null 2>/dev/null | \
            openssl x509 -noout -checkend 2592000; then
            echo "ERROR: SSL certificate will expire within 30 days or is invalid"
            return 1
        fi
    fi
    
    echo "Deployment validation successful"
    return 0
}

deploy_infrastructure() {
    local environment=$1
    local deployment_id=$2
    
    echo "Deploying infrastructure for ${environment}"
    
    # Create Terraform state backup
    local backup_path="${TERRAFORM_DIR}/${environment}/terraform.tfstate.backup.${deployment_id}"
    cp "${TERRAFORM_DIR}/${environment}/terraform.tfstate" "${backup_path}" || true
    
    # Initialize Terraform
    terraform -chdir="${TERRAFORM_DIR}/${environment}" init
    
    # Select workspace
    terraform -chdir="${TERRAFORM_DIR}/${environment}" workspace select "${environment}" || \
        terraform -chdir="${TERRAFORM_DIR}/${environment}" workspace new "${environment}"
    
    # Check for drift
    if terraform -chdir="${TERRAFORM_DIR}/${environment}" plan -detailed-exitcode; then
        echo "No infrastructure changes detected"
        return 0
    fi
    
    # Apply infrastructure changes
    if ! terraform -chdir="${TERRAFORM_DIR}/${environment}" apply -auto-approve -parallelism=10; then
        echo "ERROR: Terraform apply failed"
        return 1
    fi
    
    # Validate infrastructure health
    if ! terraform -chdir="${TERRAFORM_DIR}/${environment}" output -json > \
        "${TERRAFORM_DIR}/${environment}/outputs.${deployment_id}.json"; then
        echo "ERROR: Failed to export Terraform outputs"
        return 1
    fi
    
    echo "Infrastructure deployment successful"
    return 0
}

deploy_applications() {
    local environment=$1
    local deployment_id=$2
    
    echo "Deploying applications for ${environment}"
    
    # Build and tag containers
    local registry="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com"
    local services=("frontend" "backend" "ai-service")
    
    for service in "${services[@]}"; do
        echo "Building ${service} container"
        docker build -t "${registry}/${service}:${deployment_id}" \
                    -t "${registry}/${service}:latest" \
                    --build-arg ENV="${environment}" \
                    "../../src/${service}"
        
        # Scan container for vulnerabilities
        if ! aws ecr start-image-scan --repository-name "${service}" \
                                    --image-id imageTag="${deployment_id}" \
                                    --region "$(aws configure get region)"; then
            echo "ERROR: Container security scan failed for ${service}"
            return 1
        fi
        
        # Push container to registry
        docker push "${registry}/${service}:${deployment_id}"
        docker push "${registry}/${service}:latest"
    done
    
    # Deploy green environment
    local cluster_name="saas-platform-${environment}"
    local task_definitions=()
    
    for service in "${services[@]}"; do
        # Register new task definition
        local task_def_arn=$(aws ecs register-task-definition \
            --family "${service}-${environment}" \
            --container-definitions "[{\"name\":\"${service}\",\"image\":\"${registry}/${service}:${deployment_id}\"}]" \
            --query 'taskDefinition.taskDefinitionArn' \
            --output text)
        
        task_definitions+=("${task_def_arn}")
        
        # Update service with new task definition
        aws ecs update-service \
            --cluster "${cluster_name}" \
            --service "${service}-${environment}" \
            --task-definition "${task_def_arn}" \
            --force-new-deployment
    done
    
    # Monitor deployment health
    for i in $(seq 1 "${HEALTH_CHECK_RETRIES}"); do
        local all_healthy=true
        for service in "${services[@]}"; do
            local service_status=$(aws ecs describe-services \
                --cluster "${cluster_name}" \
                --services "${service}-${environment}" \
                --query 'services[0].deployments[0].rolloutState' \
                --output text)
            
            if [[ "${service_status}" != "COMPLETED" ]]; then
                all_healthy=false
                break
            fi
        done
        
        if ${all_healthy}; then
            echo "All services deployed successfully"
            return 0
        fi
        
        echo "Waiting for services to stabilize... (${i}/${HEALTH_CHECK_RETRIES})"
        sleep 30
    done
    
    echo "ERROR: Deployment health check timeout"
    return 1
}

deploy_monitoring() {
    local environment=$1
    local deployment_id=$2
    
    echo "Deploying monitoring stack for ${environment}"
    
    # Setup monitoring configuration
    if ! setup_monitoring "${environment}"; then
        echo "ERROR: Monitoring setup failed"
        return 1
    fi
    
    # Deploy monitoring stack
    if ! docker-compose -f "${DOCKER_COMPOSE_FILE}" \
        --env-file "${SCRIPT_DIR}/config/monitoring/${environment}.env" \
        up -d --remove-orphans; then
        echo "ERROR: Monitoring stack deployment failed"
        return 1
    fi
    
    # Validate monitoring endpoints
    local endpoints=("prometheus:9090" "grafana:3000" "alertmanager:9093")
    for endpoint in "${endpoints[@]}"; do
        if ! curl -sf "http://${endpoint}/-/healthy" >/dev/null; then
            echo "ERROR: Monitoring endpoint ${endpoint} health check failed"
            return 1
        fi
    done
    
    echo "Monitoring deployment successful"
    return 0
}

handle_rollback() {
    local environment=$1
    local deployment_id=$2
    
    echo "Initiating rollback for deployment ${deployment_id} in ${environment}"
    
    # Stop ongoing deployments
    local cluster_name="saas-platform-${environment}"
    local services=("frontend" "backend" "ai-service")
    
    for service in "${services[@]}"; do
        # Get previous task definition
        local previous_task_def=$(aws ecs describe-task-definition \
            --task-definition "${service}-${environment}" \
            --query 'taskDefinition.taskDefinitionArn' \
            --output text)
        
        # Rollback to previous task definition
        aws ecs update-service \
            --cluster "${cluster_name}" \
            --service "${service}-${environment}" \
            --task-definition "${previous_task_def}" \
            --force-new-deployment
    done
    
    # Restore Terraform state
    local backup_path="${TERRAFORM_DIR}/${environment}/terraform.tfstate.backup.${deployment_id}"
    if [[ -f "${backup_path}" ]]; then
        cp "${backup_path}" "${TERRAFORM_DIR}/${environment}/terraform.tfstate"
    fi
    
    # Wait for rollback to complete
    local timeout_end=$((SECONDS + ROLLBACK_TIMEOUT))
    while [[ ${SECONDS} -lt ${timeout_end} ]]; do
        local all_stable=true
        for service in "${services[@]}"; do
            local service_status=$(aws ecs describe-services \
                --cluster "${cluster_name}" \
                --services "${service}-${environment}" \
                --query 'services[0].deployments[0].rolloutState' \
                --output text)
            
            if [[ "${service_status}" != "COMPLETED" ]]; then
                all_stable=false
                break
            fi
        done
        
        if ${all_stable}; then
            echo "Rollback completed successfully"
            return 0
        fi
        
        sleep 10
    done
    
    echo "ERROR: Rollback failed to complete within timeout"
    return 1
}

# Main deployment function
main() {
    if [[ $# -ne 1 ]]; then
        echo "Usage: $0 <environment>"
        echo "Available environments: ${ENVIRONMENTS[*]}"
        exit 1
    fi
    
    local environment=$1
    local deployment_id
    
    # Initialize logging and get deployment ID
    deployment_id=$(setup_deployment_logging "${environment}")
    
    # Set error handler
    trap 'deployment_error_handler ${LINENO} $? "${deployment_id}" "${environment}"' ERR
    
    # Execute deployment steps
    validate_deployment "${environment}" || exit 1
    deploy_infrastructure "${environment}" "${deployment_id}" || exit 1
    deploy_applications "${environment}" "${deployment_id}" || exit 1
    deploy_monitoring "${environment}" "${deployment_id}" || exit 1
    
    echo "Deployment completed successfully"
    echo "=== Deployment Completed - ${environment} - ${deployment_id} ==="
    return 0
}

# Execute main function
main "$@"