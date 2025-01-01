# Terraform version constraints and required provider configurations for the SaaS Management Platform
# Core version >= 1.5.0 required for AWS provider compatibility and workspace features
# AWS Provider ~> 5.0 required for ECS Fargate, RDS Multi-AZ, ElastiCache, DocumentDB, and WAF v2 support

terraform {
  # Specify minimum required Terraform version
  required_version = ">= 1.5.0"

  # Define required providers with version constraints
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}