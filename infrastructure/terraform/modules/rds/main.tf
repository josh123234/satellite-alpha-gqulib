# AWS Provider configuration with version constraints
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for RDS KMS encryption key
data "aws_kms_key" "rds" {
  key_id = "alias/aws/rds"
}

# Data source for RDS enhanced monitoring IAM role
data "aws_iam_role" "enhanced_monitoring" {
  name = "rds-enhanced-monitoring-role"
}

# Local variables for resource configuration
locals {
  common_tags = {
    Environment = var.environment
    Project     = "saas-management-platform"
    ManagedBy   = "terraform"
    Service     = "database"
  }

  backup_config = {
    backup_retention_period = 7
    backup_window          = "03:00-04:00"
    maintenance_window     = "Mon:04:00-Mon:05:00"
  }

  monitoring_config = {
    monitoring_interval                    = 60
    performance_insights_enabled           = true
    performance_insights_retention_period  = 7
  }
}

# DB subnet group for RDS instances
resource "aws_db_subnet_group" "main" {
  name        = "${var.environment}-rds-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Subnet group for RDS instances in ${var.environment} environment"

  tags = merge(local.common_tags, {
    Name = "${var.environment}-rds-subnet-group"
  })
}

# DB parameter group for PostgreSQL optimization
resource "aws_db_parameter_group" "main" {
  name        = "${var.environment}-postgres-params"
  family      = "postgres15"
  description = "Custom parameter group for PostgreSQL 15 in ${var.environment} environment"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }

  parameter {
    name  = "work_mem"
    value = "64MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "256MB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "autovacuum"
    value = "1"
  }

  tags = local.common_tags
}

# Primary RDS instance
resource "aws_db_instance" "main" {
  identifier     = "${var.environment}-postgres"
  engine         = "postgres"
  engine_version = "15.4"

  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = data.aws_kms_key.rds.arn

  db_name  = var.db_name
  username = var.master_username
  password = var.master_password

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name
  vpc_security_group_ids = var.security_group_ids

  backup_retention_period = local.backup_config.backup_retention_period
  backup_window          = local.backup_config.backup_window
  maintenance_window     = local.backup_config.maintenance_window

  monitoring_interval             = local.monitoring_config.monitoring_interval
  monitoring_role_arn            = data.aws_iam_role.enhanced_monitoring.arn
  performance_insights_enabled    = local.monitoring_config.performance_insights_enabled
  performance_insights_retention_period = local.monitoring_config.performance_insights_retention_period

  auto_minor_version_upgrade = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.environment}-postgres-final-snapshot"
  copy_tags_to_snapshot    = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(local.common_tags, {
    Name = "${var.environment}-postgres-primary"
  })
}

# Cross-region read replica
resource "aws_db_instance_replica" "replica" {
  provider = aws.replica_region
  count    = var.replica_enabled ? 1 : 0

  identifier     = "${var.environment}-postgres-replica"
  instance_class = var.replica_instance_class
  replicate_source_db = aws_db_instance.main.arn

  multi_az = true
  storage_encrypted = true
  kms_key_id       = data.aws_kms_key.rds.arn

  monitoring_interval             = local.monitoring_config.monitoring_interval
  monitoring_role_arn            = data.aws_iam_role.enhanced_monitoring.arn
  performance_insights_enabled    = local.monitoring_config.performance_insights_enabled
  performance_insights_retention_period = local.monitoring_config.performance_insights_retention_period

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(local.common_tags, {
    Name = "${var.environment}-postgres-replica"
  })
}

# Outputs
output "primary_endpoint" {
  description = "The connection endpoint for the primary RDS instance"
  value = {
    endpoint = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
  }
}

output "replica_endpoint" {
  description = "The connection endpoint for the read replica"
  value = var.replica_enabled ? {
    endpoint = aws_db_instance_replica.replica[0].endpoint
  } : null
}