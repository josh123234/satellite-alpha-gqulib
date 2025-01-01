# Core Terraform functionality for variable definitions and validation rules
terraform {
  required_version = "~> 1.5"
}

variable "environment" {
  description = "Deployment environment identifier (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "instance_class" {
  description = "RDS instance class based on environment (dev: db.t3.large, staging: db.r5.xlarge, prod: db.r5.2xlarge)"
  type        = string
  default     = "db.r5.2xlarge"
  validation {
    condition     = can(regex("^db\\.(t3|r5|r6g)\\.(large|xlarge|2xlarge|4xlarge)$", var.instance_class))
    error_message = "Instance class must be a valid RDS instance type"
  }
}

variable "allocated_storage" {
  description = "Initial storage allocation in GB (min: 100GB for prod)"
  type        = number
  default     = 100
  validation {
    condition     = var.allocated_storage >= 100
    error_message = "Allocated storage must be at least 100GB"
  }
}

variable "max_allocated_storage" {
  description = "Maximum storage allocation in GB for autoscaling (max: 1000GB)"
  type        = number
  default     = 1000
  validation {
    condition     = var.max_allocated_storage >= var.allocated_storage
    error_message = "Maximum allocated storage must be greater than or equal to initial allocation"
  }
}

variable "db_name" {
  description = "Name of the default database to create"
  type        = string
  default     = "saas_platform"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability (required for prod)"
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Number of days to retain automated backups (min: 30 days for prod)"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_period >= 7
    error_message = "Backup retention period must be at least 7 days"
  }
}

variable "backup_window" {
  description = "Preferred backup window (must not overlap with maintenance window)"
  type        = string
  default     = "03:00-04:00"
  validation {
    condition     = can(regex("^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$", var.backup_window))
    error_message = "Backup window must be in format HH:MM-HH:MM"
  }
}

variable "maintenance_window" {
  description = "Preferred maintenance window (must not overlap with backup window)"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
  validation {
    condition     = can(regex("^[A-Za-z]{3}:[0-2][0-9]:[0-5][0-9]-[A-Za-z]{3}:[0-2][0-9]:[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in format Day:HH:MM-Day:HH:MM"
  }
}

variable "deletion_protection" {
  description = "Enable deletion protection (required for prod)"
  type        = bool
  default     = true
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (1, 5, 10, 15, 30, 60)"
  type        = number
  default     = 60
  validation {
    condition     = contains([1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 1, 5, 10, 15, 30, 60"
  }
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights for advanced monitoring"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days (7 or 731)"
  type        = number
  default     = 731
  validation {
    condition     = contains([7, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention must be either 7 or 731 days"
  }
}

variable "replica_enabled" {
  description = "Enable cross-region read replica for disaster recovery"
  type        = bool
  default     = true
}

variable "replica_region" {
  description = "AWS region for cross-region replica deployment"
  type        = string
  default     = "us-west-2"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.replica_region))
    error_message = "Replica region must be a valid AWS region identifier"
  }
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for RDS deployment"
  type        = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets must be provided for high availability"
  }
}

variable "vpc_security_group_ids" {
  description = "List of VPC security group IDs"
  type        = list(string)
  validation {
    condition     = length(var.vpc_security_group_ids) >= 1
    error_message = "At least one security group must be provided"
  }
}

variable "tags" {
  description = "Additional tags for RDS resources"
  type        = map(string)
  default     = {}
}