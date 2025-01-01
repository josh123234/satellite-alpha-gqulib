# Configure Terraform backend for state management
terraform {
  backend "s3" {
    bucket         = "saas-management-platform-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for environment configuration
locals {
  environment  = "prod"
  aws_region   = "us-east-1"
  project_name = "saas-management-platform"
  tags = {
    Environment = "Production"
    Project     = "SaaS Management Platform"
    ManagedBy   = "Terraform"
  }
}

# VPC Module for production environment
module "vpc" {
  source = "../../modules/vpc"

  environment = local.environment
  vpc_cidr    = "10.0.0.0/16"
  azs         = ["us-east-1a", "us-east-1b", "us-east-1c"]
  project     = local.project_name

  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_flow_logs     = true
  enable_vpc_endpoints = true
  nat_gateway_count    = 3
}

# API Gateway Module for production environment
module "api_gateway" {
  source = "../../modules/api-gateway"

  environment         = local.environment
  project_name        = local.project_name
  vpc_id             = module.vpc.vpc_id
  enable_mutual_tls   = true
  enable_access_logs  = true
  metrics_enabled     = true
  xray_tracing_enabled = true

  # Production-grade throttling settings
  throttling_rate_limit  = 10000
  throttling_burst_limit = 5000

  # Enhanced logging and monitoring
  logging_level       = "ERROR"
  data_trace_enabled  = false

  # Production caching configuration
  enable_caching     = true
  cache_size         = "6.1"

  # Security configurations
  web_acl_id         = aws_wafv2_web_acl.main.arn
}

# ECS Module for production environment
module "ecs" {
  source = "../../modules/ecs"

  environment     = local.environment
  project_name    = local.project_name
  vpc_id         = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # Enhanced production configurations
  enable_container_insights = true
  enable_service_discovery = true
  auto_scaling_min_capacity = 3
  auto_scaling_max_capacity = 20

  # Security configurations
  kms_key_arn    = aws_kms_key.ecs.arn
  secrets_arn    = aws_secretsmanager_secret.ecs.arn

  tags = local.tags
}

# WAF Web ACL for API Gateway protection
resource "aws_wafv2_web_acl" "main" {
  name        = "${local.project_name}-${local.environment}"
  description = "WAF Web ACL for API Gateway"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Rules
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${local.project_name}-waf-metrics"
    sampled_requests_enabled  = true
  }

  tags = local.tags
}

# KMS key for ECS encryption
resource "aws_kms_key" "ecs" {
  description             = "KMS key for ECS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.tags
}

# Secrets Manager secret for ECS
resource "aws_secretsmanager_secret" "ecs" {
  name        = "${local.project_name}/${local.environment}/ecs"
  description = "Secrets for ECS tasks"
  kms_key_id  = aws_kms_key.ecs.id

  tags = local.tags
}

# Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "api_gateway_endpoint" {
  description = "The API Gateway endpoint URL"
  value       = module.api_gateway.invoke_url
}