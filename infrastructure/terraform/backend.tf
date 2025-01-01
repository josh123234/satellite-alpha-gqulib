# Backend configuration for SaaS Management Platform
# Version: 1.0.0
# Provider version: aws ~> 5.0

terraform {
  backend "s3" {
    # S3 bucket for state storage with dynamic naming based on project
    bucket = "${var.project_name}-terraform-state"
    
    # Environment-based state file path
    key = "${var.environment}/terraform.tfstate"
    
    # AWS region configuration
    region = "${var.aws_region}"
    
    # DynamoDB table for state locking
    dynamodb_table = "${var.project_name}-terraform-locks"
    
    # Enable encryption at rest
    encrypt = true
    
    # Server-side encryption configuration using AWS KMS
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm     = "aws:kms"
          kms_master_key_id = "aws/s3"
        }
      }
    }
    
    # Enable versioning for state file history
    versioning {
      enabled = true
    }
    
    # Access control configuration
    acl                = "private"
    block_public_acls  = true
    block_public_policy = true
    ignore_public_acls = true
    restrict_public_buckets = true
    
    # Additional security configurations
    force_destroy = false
    
    # Enable access logging
    logging {
      target_bucket = "${var.project_name}-terraform-logs"
      target_prefix = "state-access-logs/"
    }
  }
}

# Configure minimum required provider version
provider "aws" {
  region = var.aws_region
  
  # Default tags for all resources
  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}