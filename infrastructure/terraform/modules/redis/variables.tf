# Project name variable
variable "project" {
  type        = string
  description = "Project name for resource naming and tagging"
}

# Environment name variable
variable "environment" {
  type        = string
  description = "Environment name for resource tagging and configuration"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Redis node type variable
variable "redis_node_type" {
  type        = string
  description = "The compute and memory capacity of the nodes"
  default     = "cache.t3.medium"

  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.redis_node_type))
    error_message = "Redis node type must be a valid AWS ElastiCache instance type"
  }
}

# Redis parameter group family
variable "redis_parameter_group_family" {
  type        = string
  description = "Redis parameter group family version"
  default     = "redis7"

  validation {
    condition     = can(regex("^redis[0-9]+$", var.redis_parameter_group_family))
    error_message = "Redis parameter group family must be a valid version (e.g., redis7)"
  }
}

# Redis port number
variable "redis_port" {
  type        = number
  description = "Port number for Redis cluster"
  default     = 6379

  validation {
    condition     = var.redis_port > 1024 && var.redis_port < 65535
    error_message = "Redis port must be between 1024 and 65535"
  }
}

# Automatic failover configuration
variable "redis_auto_failover" {
  type        = bool
  description = "Enable automatic failover for high availability"
  default     = true
}

# Multi-AZ deployment configuration
variable "redis_multi_az" {
  type        = bool
  description = "Enable multi-AZ deployment for disaster recovery"
  default     = true
}

# Number of cache clusters
variable "redis_num_cache_clusters" {
  type        = number
  description = "Number of cache clusters in replication group"
  default     = 2

  validation {
    condition     = var.redis_num_cache_clusters >= 2
    error_message = "At least 2 cache clusters are required for high availability"
  }
}

# Encryption at rest configuration
variable "redis_at_rest_encryption" {
  type        = bool
  description = "Enable encryption at rest for data security"
  default     = true
}

# Transit encryption configuration
variable "redis_transit_encryption" {
  type        = bool
  description = "Enable encryption in transit for data security"
  default     = true
}

# Maintenance window configuration
variable "redis_maintenance_window" {
  type        = string
  description = "Weekly maintenance window"

  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]-[0-2][0-9]:[0-5][0-9]$", var.redis_maintenance_window))
    error_message = "Maintenance window must be in the format 'ddd:hh:mm-hh:mm'"
  }
}

# Snapshot window configuration
variable "redis_snapshot_window" {
  type        = string
  description = "Daily time range for automated snapshot creation"

  validation {
    condition     = can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.redis_snapshot_window))
    error_message = "Snapshot window must be in the format 'hh:mm-hh:mm'"
  }
}

# Snapshot retention configuration
variable "redis_snapshot_retention_limit" {
  type        = number
  description = "Number of days to retain automatic snapshots"
  default     = 7

  validation {
    condition     = var.redis_snapshot_retention_limit >= 7
    error_message = "Snapshot retention must be at least 7 days for compliance"
  }
}

# VPC configuration
variable "vpc_id" {
  type        = string
  description = "VPC ID for Redis deployment"
}

# VPC CIDR block configuration
variable "vpc_cidr_block" {
  type        = string
  description = "VPC CIDR block for security group rules"

  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr_block))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation"
  }
}

# Private subnet configuration
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for Redis deployment"

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets are required for multi-AZ deployment"
  }
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all resources"
  default     = {}
}