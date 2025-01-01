# AWS Configuration
variable "aws_region" {
  type        = string
  description = "Primary AWS region for infrastructure deployment, hosts main application components"
  default     = "us-east-1"
}

variable "aws_dr_region" {
  type        = string
  description = "Secondary AWS region for disaster recovery deployment, maintains warm standby"
  default     = "us-west-2"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account identifier for resource deployment and access control"
  sensitive   = true
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment identifier controlling infrastructure sizing and configuration"

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod - no other values are allowed"
  }
}

variable "project_name" {
  type        = string
  description = "Project identifier used for resource naming and tagging conventions"
  default     = "saas-management-platform"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags applied to all infrastructure components"
  default = {
    Project     = "SaaS Management Platform"
    ManagedBy   = "terraform"
    Environment = "${var.environment}"
  }
}

# Infrastructure Sizing
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC network configuration, must not overlap with existing ranges"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "rds_instance_class" {
  type        = string
  description = "RDS instance type selection based on environment requirements and load"
  default     = "db.r5.2xlarge"

  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.rds_instance_class))
    error_message = "RDS instance class must be a valid instance type format (e.g., db.r5.2xlarge)"
  }
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type for caching and session management"
  default     = "cache.r6g.large"

  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.redis_node_type))
    error_message = "Redis node type must be a valid instance type format (e.g., cache.r6g.large)"
  }
}

variable "ecs_task_cpu" {
  type        = number
  description = "CPU units allocated to ECS tasks (1024 units = 1 vCPU)"
  default     = 1024

  validation {
    condition     = var.ecs_task_cpu >= 256 && var.ecs_task_cpu <= 4096
    error_message = "ECS task CPU must be between 256 and 4096 units"
  }
}

variable "ecs_task_memory" {
  type        = number
  description = "Memory allocation for ECS tasks in MiB"
  default     = 2048

  validation {
    condition     = var.ecs_task_memory >= 512 && var.ecs_task_memory <= 30720
    error_message = "ECS task memory must be between 512 and 30720 MiB"
  }
}

# Feature Flags
variable "enable_container_insights" {
  type        = bool
  description = "Flag to enable CloudWatch Container Insights monitoring for ECS clusters"
  default     = true
}