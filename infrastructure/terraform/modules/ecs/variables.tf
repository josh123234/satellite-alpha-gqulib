# Project name variable with validation for naming convention
variable "project_name" {
  type        = string
  description = "Name of the project for resource naming"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

# Environment variable with restricted valid values
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# VPC ID variable with format validation
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where ECS cluster will be deployed"

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must start with 'vpc-'"
  }
}

# Private subnet IDs variable with high availability validation
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for ECS task deployment"

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets required for high availability"
  }
}

# Container insights monitoring toggle
variable "container_insights" {
  type        = bool
  description = "Enable CloudWatch Container Insights for the ECS cluster"
  default     = true
}

# Log retention configuration with compliance validation
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain CloudWatch logs"
  default     = 30

  validation {
    condition     = var.log_retention_days >= 30
    error_message = "Log retention must be at least 30 days for compliance"
  }
}

# Resource tagging configuration with compliance requirements
variable "tags" {
  type        = map(string)
  description = "Additional tags for resources"
  default = {
    ManagedBy  = "terraform"
    Component  = "ecs"
  }

  validation {
    condition     = contains(keys(var.tags), "Owner")
    error_message = "Tags must include an Owner tag for compliance"
  }
}

# Task CPU allocation with Fargate-supported values validation
variable "task_cpu" {
  type        = map(number)
  description = "CPU units for different service tasks"

  validation {
    condition     = alltrue([for v in values(var.task_cpu) : contains([256, 512, 1024, 2048, 4096], v)])
    error_message = "CPU values must be Fargate-supported units: 256, 512, 1024, 2048, 4096"
  }
}

# Task memory allocation with Fargate limits validation
variable "task_memory" {
  type        = map(number)
  description = "Memory limits in MB for different service tasks"

  validation {
    condition     = alltrue([for v in values(var.task_memory) : v >= 512 && v <= 30720])
    error_message = "Memory values must be between 512MB and 30720MB"
  }
}