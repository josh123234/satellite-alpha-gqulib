# VPC CIDR block variable with IPv4 format validation
variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation"
  }
}

# Environment name variable with restricted valid values
variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod)"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Project name variable with platform-specific default
variable "project" {
  type        = string
  description = "Project name for resource tagging"
  default     = "saas-management-platform"
}

# Availability zones variable with minimum count validation
variable "azs" {
  type        = list(string)
  description = "List of availability zones for subnet distribution"

  validation {
    condition     = length(var.azs) >= 2
    error_message = "At least 2 availability zones must be specified for high availability"
  }
}

# Private subnet CIDR blocks variable with AZ count validation
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets, one per AZ"

  validation {
    condition     = length(var.private_subnet_cidrs) == length(var.azs)
    error_message = "Number of private subnet CIDRs must match number of availability zones"
  }
}

# Public subnet CIDR blocks variable with AZ count validation
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets, one per AZ"

  validation {
    condition     = length(var.public_subnet_cidrs) == length(var.azs)
    error_message = "Number of public subnet CIDRs must match number of availability zones"
  }
}