# Configure Terraform settings and required providers
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Define local variables for environment configuration
locals {
  environment = "dev"
  project_name = "saas-mgmt-platform"
  common_tags = {
    Environment = "dev"
    Project = "SaaS Management Platform"
    ManagedBy = "terraform"
    CostCenter = "development"
    SecurityZone = "development"
    DataClassification = "internal"
  }
}

# Variables declaration
variable "aws_region" {
  type = string
  default = "us-east-1"
  description = "AWS region for development environment"
}

variable "aws_account_id" {
  type = string
  description = "AWS account ID for resource deployment"
}

variable "enable_monitoring" {
  type = bool
  default = true
  description = "Enable enhanced monitoring and alerting"
}

variable "enable_debug_logging" {
  type = bool
  default = true
  description = "Enable debug level logging for development"
}

# VPC Module configuration
module "vpc" {
  source = "../../modules/vpc"
  
  environment = local.environment
  project_name = local.project_name
  vpc_cidr = "10.0.0.0/16"
  azs = ["us-east-1a", "us-east-1b"]
  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnet_cidrs = ["10.0.101.0/24", "10.0.102.0/24"]
  common_tags = local.common_tags
  
  enable_flow_logs = true
  enable_vpc_endpoints = true
  nat_gateway_count = 1
}

# ECS Module configuration
module "ecs" {
  source = "../../modules/ecs"
  
  environment = local.environment
  project_name = local.project_name
  vpc_id = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  common_tags = local.common_tags
  
  cluster_settings = {
    container_insights = "enabled"
    capacity_providers = ["FARGATE"]
    minimum_capacity = 1
    maximum_capacity = 4
    enable_execute_command = true
    enable_container_insights = true
  }
  
  monitoring_config = {
    metrics_namespace = "Development/ECS"
    log_retention_days = 14
    enable_alarm_actions = true
  }

  # KMS and Secrets configuration for development
  kms_key_arn = "arn:aws:kms:${var.aws_region}:${var.aws_account_id}:key/dev-key"
  secrets_arn = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:dev/*"
  
  tags = local.common_tags
}

# Output values
output "vpc_id" {
  description = "The ID of the VPC"
  value = module.vpc.vpc_id
}

output "ecs_cluster_arn" {
  description = "The ARN of the ECS cluster"
  value = module.ecs.cluster_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value = module.vpc.public_subnet_ids
}

output "ecs_security_group_id" {
  description = "The ID of the ECS security group"
  value = module.ecs.security_group_id
}

output "ecs_task_execution_role_arn" {
  description = "The ARN of the ECS task execution role"
  value = module.ecs.task_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "The ARN of the ECS task role"
  value = module.ecs.task_role_arn
}

output "service_discovery_namespace_id" {
  description = "The ID of the service discovery namespace"
  value = module.ecs.service_discovery_namespace_id
}