# AWS Provider Configuration for SaaS Management Platform
# Provider Version: ~> 5.0

# Configure the AWS Provider for primary region
provider "aws" {
  region = var.aws_region

  # Apply common tags to all resources created by this provider
  default_tags {
    tags = var.common_tags
  }
}

# Configure the AWS Provider for disaster recovery region
provider "aws" {
  alias  = "dr"
  region = var.aws_dr_region

  # Apply common tags to all resources created by this provider
  default_tags {
    tags = var.common_tags
  }
}

# Terraform required providers block
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}