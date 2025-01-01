# AWS Provider configuration for staging environment
# Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "saas-management-platform-tfstate-staging"
    key    = "staging/terraform.tfstate"
    region = "us-east-2"
    encrypt = true
    dynamodb_table = "terraform-lock-staging"
  }
}

# Reference provider configuration
module "provider" {
  source = "../../provider"
}

# Local variables for staging environment
locals {
  environment = "staging"
  aws_region = "us-east-2"
  common_tags = {
    Environment = "staging"
    Project     = "saas-management-platform"
    ManagedBy   = "terraform"
  }
}

# VPC Module for staging environment
module "vpc" {
  source = "../../modules/vpc"
  
  cidr_block = "10.1.0.0/16"
  availability_zones = [
    "us-east-2a",
    "us-east-2b",
    "us-east-2c"
  ]
  environment = local.environment
  
  tags = merge(local.common_tags, {
    Name = "staging-vpc"
  })
}

# ECS Module for staging environment with fixed capacity
module "ecs" {
  source = "../../modules/ecs"
  
  cluster_name     = "staging-cluster"
  instance_type    = "t3.medium"
  fixed_size       = true
  desired_capacity = 3
  environment      = local.environment
  vpc_id           = module.vpc.vpc_id
  subnet_ids       = module.vpc.private_subnet_ids
  
  tags = merge(local.common_tags, {
    Name = "staging-ecs-cluster"
  })
}

# RDS Module for staging environment
module "rds" {
  source = "../../modules/rds"
  
  instance_class         = "db.t3.large"
  multi_az              = true
  backup_retention_period = 7
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.database_subnet_ids
  
  tags = merge(local.common_tags, {
    Name = "staging-rds"
  })
}

# ElastiCache Module for staging environment
module "elasticache" {
  source = "../../modules/elasticache"
  
  node_type       = "cache.t3.medium"
  num_cache_nodes = 2
  environment     = local.environment
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  
  tags = merge(local.common_tags, {
    Name = "staging-elasticache"
  })
}

# Monitoring Module for staging environment
module "monitoring" {
  source = "../../modules/monitoring"
  
  log_retention_days = 30
  alert_thresholds = {
    cpu_utilization    = 80
    memory_utilization = 80
    response_time      = 2000
  }
  environment = local.environment
  
  tags = merge(local.common_tags, {
    Name = "staging-monitoring"
  })
}

# Output values for staging environment
output "vpc_id" {
  value = module.vpc.vpc_id
  description = "The ID of the staging VPC"
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
  description = "The name of the staging ECS cluster"
}

output "rds_endpoint" {
  value = module.rds.endpoint
  description = "The endpoint of the staging RDS instance"
  sensitive = true
}

output "elasticache_endpoint" {
  value = module.elasticache.endpoint
  description = "The endpoint of the staging ElastiCache cluster"
  sensitive = true
}

output "monitoring_dashboard_url" {
  value = module.monitoring.dashboard_url
  description = "The URL of the staging CloudWatch dashboard"
}