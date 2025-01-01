#!/bin/bash

# init-monitoring.sh
# Initializes and configures a comprehensive monitoring stack for the SaaS Management Platform
# Version: 1.0.0
# Dependencies:
# - docker-compose v3.8+
# - aws-cli v2.x
# - prometheus v2.45.x
# - grafana v9.5.x
# - alertmanager v0.25.x

set -euo pipefail

# Global variables
MONITORING_DIR="../docker/monitoring"
LOG_FILE="/var/log/monitoring-init.log"
AWS_REGION="${AWS_REGION:-us-east-1}"
RETENTION_DAYS="${RETENTION_DAYS:-15}"

# Required environment variables check array
REQUIRED_ENV_VARS=(
    "GRAFANA_ADMIN_PASSWORD"
    "ALERT_SLACK_WEBHOOK"
    "PAGERDUTY_SERVICE_KEY"
    "ALERT_EMAIL"
)

# Logging function
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Error handling function
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Check prerequisites for monitoring stack
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check Docker version
    if ! docker --version | grep -q "20.10"; then
        error_exit "Docker version 20.10 or higher is required"
    fi

    # Check docker-compose version
    if ! docker-compose version | grep -q "3.8"; then
        error_exit "docker-compose version 3.8 or higher is required"
    }

    # Check AWS CLI
    if ! aws --version | grep -q "aws-cli/2"; then
        error_exit "AWS CLI version 2 is required"
    }

    # Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        error_exit "Invalid AWS credentials"
    }

    # Check required environment variables
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done

    # Check disk space (minimum 20GB required)
    available_space=$(df -BG "${MONITORING_DIR}" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $available_space -lt 20 ]]; then
        error_exit "Insufficient disk space. At least 20GB required"
    }

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Create required directories with appropriate permissions
create_directories() {
    log "INFO" "Creating monitoring directories..."

    local dirs=(
        "${MONITORING_DIR}/prometheus/data"
        "${MONITORING_DIR}/grafana/data"
        "${MONITORING_DIR}/alertmanager/data"
        "${MONITORING_DIR}/grafana/provisioning/dashboards"
        "${MONITORING_DIR}/grafana/provisioning/datasources"
        "${MONITORING_DIR}/prometheus/rules"
        "${MONITORING_DIR}/ssl"
        "${MONITORING_DIR}/backup"
    )

    for dir in "${dirs[@]}"; do
        mkdir -p "$dir" || error_exit "Failed to create directory: $dir"
    done

    # Set appropriate permissions
    chmod 2777 "${MONITORING_DIR}/prometheus/data"
    chmod 472 "${MONITORING_DIR}/grafana/data"
    chmod 2777 "${MONITORING_DIR}/alertmanager/data"

    log "INFO" "Directory creation completed successfully"
    return 0
}

# Configure AWS permissions and integration
configure_aws_permissions() {
    log "INFO" "Configuring AWS permissions..."

    # Create CloudWatch Log Group
    aws logs create-log-group \
        --log-group-name "/monitoring/saas-platform" \
        --region "$AWS_REGION" || error_exit "Failed to create CloudWatch Log Group"

    # Set retention policy
    aws logs put-retention-policy \
        --log-group-name "/monitoring/saas-platform" \
        --retention-in-days "$RETENTION_DAYS" \
        --region "$AWS_REGION" || error_exit "Failed to set log retention policy"

    # Create IAM role for monitoring services
    aws iam create-role \
        --role-name monitoring-service-role \
        --assume-role-policy-document file://"${MONITORING_DIR}/iam/monitoring-trust-policy.json" \
        || log "WARN" "IAM role already exists"

    # Attach required policies
    local policies=(
        "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
        "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
    )

    for policy in "${policies[@]}"; do
        aws iam attach-role-policy \
            --role-name monitoring-service-role \
            --policy-arn "$policy" \
            || log "WARN" "Policy $policy attachment failed"
    done

    log "INFO" "AWS permissions configured successfully"
    return 0
}

# Start the monitoring stack
start_monitoring_stack() {
    log "INFO" "Starting monitoring stack..."

    cd "$MONITORING_DIR" || error_exit "Failed to change to monitoring directory"

    # Pull latest images
    docker-compose pull || error_exit "Failed to pull monitoring images"

    # Start the stack
    docker-compose up -d || error_exit "Failed to start monitoring stack"

    # Wait for services to be healthy
    local services=("prometheus" "grafana" "alertmanager")
    for service in "${services[@]}"; do
        timeout 300 bash -c "until docker-compose ps $service | grep -q 'healthy'; do sleep 5; done" \
            || error_exit "Service $service failed to become healthy"
    done

    log "INFO" "Monitoring stack started successfully"
    return 0
}

# Verify monitoring setup
verify_monitoring() {
    log "INFO" "Verifying monitoring setup..."

    # Check Prometheus
    if ! curl -sf "http://localhost:9090/-/healthy" >/dev/null; then
        error_exit "Prometheus health check failed"
    fi

    # Check Grafana
    if ! curl -sf "http://localhost:3000/api/health" >/dev/null; then
        error_exit "Grafana health check failed"
    fi

    # Check Alertmanager
    if ! curl -sf "http://localhost:9093/-/healthy" >/dev/null; then
        error_exit "Alertmanager health check failed"
    fi

    # Verify CloudWatch integration
    aws cloudwatch list-metrics \
        --namespace "SaaSPlatform" \
        --region "$AWS_REGION" \
        || error_exit "CloudWatch integration check failed"

    # Verify X-Ray daemon
    if ! curl -sf "http://localhost:2000/GetSamplingRules" >/dev/null; then
        error_exit "X-Ray daemon check failed"
    fi

    # Test alert notification channels
    curl -X POST "http://localhost:9093/api/v1/alerts" \
        -H "Content-Type: application/json" \
        -d '[{"labels":{"alertname":"MonitoringTest","severity":"info"}}]' \
        || error_exit "Alert notification test failed"

    log "INFO" "Monitoring verification completed successfully"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting monitoring initialization..."

    # Create log file if it doesn't exist
    touch "$LOG_FILE" || error_exit "Cannot create log file"

    # Execute initialization steps
    check_prerequisites || error_exit "Prerequisites check failed"
    create_directories || error_exit "Directory creation failed"
    configure_aws_permissions || error_exit "AWS configuration failed"
    start_monitoring_stack || error_exit "Stack startup failed"
    verify_monitoring || error_exit "Monitoring verification failed"

    log "INFO" "Monitoring initialization completed successfully"
    return 0
}

# Execute main function
main "$@"