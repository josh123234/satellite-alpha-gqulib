# Core Terraform functionality for variable definitions and validation
terraform {
  required_version = "~> 1.5"
}

# Project Configuration
variable "project_name" {
  description = "Name of the project for resource naming"
  type        = string
  default     = "saas-management-platform"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Caching Configuration
variable "enable_caching" {
  description = "Enable API Gateway caching. Recommended for production environments"
  type        = bool
  default     = false
}

variable "cache_size" {
  description = "Size of the API Gateway cache in GB. Available sizes: 0.5, 1.6, 6.1, 13.5, 28.4, 58.2, 118, 237"
  type        = string
  default     = "0.5"

  validation {
    condition     = can(regex("^(0.5|1.6|6.1|13.5|28.4|58.2|118|237)$", var.cache_size))
    error_message = "Cache size must be one of: 0.5, 1.6, 6.1, 13.5, 28.4, 58.2, 118, 237"
  }
}

# Observability Configuration
variable "xray_tracing_enabled" {
  description = "Enable AWS X-Ray tracing for request tracking and performance analysis"
  type        = bool
  default     = true
}

# Performance Configuration
variable "throttling_burst_limit" {
  description = "API Gateway throttling burst limit. Adjust based on load testing results"
  type        = number
  default     = 5000

  validation {
    condition     = var.throttling_burst_limit >= 1000 && var.throttling_burst_limit <= 10000
    error_message = "Burst limit must be between 1000 and 10000"
  }
}

variable "throttling_rate_limit" {
  description = "API Gateway throttling rate limit per second. Adjust based on load testing results"
  type        = number
  default     = 10000

  validation {
    condition     = var.throttling_rate_limit >= 2000 && var.throttling_rate_limit <= 20000
    error_message = "Rate limit must be between 2000 and 20000"
  }
}

# Logging and Monitoring Configuration
variable "logging_level" {
  description = "CloudWatch logging level for API Gateway. Set to ERROR in production for optimal performance"
  type        = string
  default     = "INFO"

  validation {
    condition     = can(regex("^(OFF|ERROR|INFO)$", var.logging_level))
    error_message = "Logging level must be OFF, ERROR, or INFO"
  }
}

variable "metrics_enabled" {
  description = "Enable detailed CloudWatch metrics for API Gateway monitoring"
  type        = bool
  default     = true
}

variable "data_trace_enabled" {
  description = "Enable request/response data tracing. Use with caution in production due to data sensitivity"
  type        = bool
  default     = false
}

# Network Configuration
variable "vpc_id" {
  description = "VPC ID for VPC Link configuration. Required for private API endpoints"
  type        = string

  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC ID format"
  }
}

# Security Configuration
variable "web_acl_id" {
  description = "WAF Web ACL ID for API Gateway protection. Highly recommended for production"
  type        = string
  default     = null

  validation {
    condition     = var.web_acl_id == null || can(regex("^arn:aws:wafv2:[a-z0-9-]+:[0-9]+:regional/webacl/[a-zA-Z0-9-_]+/[a-z0-9-]+$", var.web_acl_id))
    error_message = "Web ACL ID must be a valid AWS WAF v2 ARN format or null"
  }
}

variable "enable_access_logs" {
  description = "Enable API Gateway access logs to CloudWatch"
  type        = bool
  default     = true
}

variable "enable_mutual_tls" {
  description = "Enable mutual TLS authentication for enhanced API security"
  type        = bool
  default     = false
}