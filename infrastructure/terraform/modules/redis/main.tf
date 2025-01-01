# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  redis_family = "redis7.x"
  redis_port   = 6379
  redis_tags   = merge(var.tags, {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  })
  monitoring_dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }
}

# Subnet group for Redis cluster deployment
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = local.redis_tags
}

# Parameter group for Redis optimization
resource "aws_elasticache_parameter_group" "main" {
  family = var.redis_parameter_group_family
  name   = "${var.project}-${var.environment}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"
  }

  tags = local.redis_tags
}

# Redis replication group with enhanced security and monitoring
resource "aws_elasticache_replication_group" "main" {
  replication_group_id          = "${var.project}-${var.environment}-redis"
  description                   = "Redis cluster for ${var.project} ${var.environment}"
  node_type                     = var.redis_node_type
  port                         = local.redis_port
  parameter_group_name         = aws_elasticache_parameter_group.main.name
  subnet_group_name            = aws_elasticache_subnet_group.main.name
  security_group_ids           = [aws_security_group.main.id]
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  num_cache_clusters          = var.redis_num_cache_clusters
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                 = var.redis_auth_token
  kms_key_id                 = var.kms_key_id
  maintenance_window         = var.redis_maintenance_window
  snapshot_window           = var.redis_snapshot_window
  snapshot_retention_limit  = 7
  auto_minor_version_upgrade = true
  apply_immediately         = false
  tags                     = local.redis_tags
}

# Security group for Redis cluster access
resource "aws_security_group" "main" {
  name        = "${var.project}-${var.environment}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis access from VPC"
    from_port   = local.redis_port
    to_port     = local.redis_port
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }

  egress {
    description = "Deny all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.redis_tags
}

# CloudWatch alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  alarm_name          = "${var.project}-${var.environment}-redis-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ElastiCache"
  period             = 300
  statistic          = "Average"
  threshold          = 75
  alarm_description  = "Redis cluster CPU utilization"
  dimensions         = local.monitoring_dimensions
  alarm_actions      = [var.alarm_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "memory_usage" {
  alarm_name          = "${var.project}-${var.environment}-redis-memory-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "DatabaseMemoryUsagePercentage"
  namespace          = "AWS/ElastiCache"
  period             = 300
  statistic          = "Average"
  threshold          = 80
  alarm_description  = "Redis cluster memory usage"
  dimensions         = local.monitoring_dimensions
  alarm_actions      = [var.alarm_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "cache_hits" {
  alarm_name          = "${var.project}-${var.environment}-redis-cache-hits"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name        = "CacheHitRate"
  namespace          = "AWS/ElastiCache"
  period             = 300
  statistic          = "Average"
  threshold          = 50
  alarm_description  = "Redis cluster cache hit rate"
  dimensions         = local.monitoring_dimensions
  alarm_actions      = [var.alarm_topic_arn]
}

# Outputs for Redis endpoints and security group
output "redis_endpoint" {
  description = "Redis cluster endpoints"
  value = {
    primary_endpoint_address = aws_elasticache_replication_group.main.primary_endpoint_address
    reader_endpoint_address = aws_elasticache_replication_group.main.reader_endpoint_address
  }
}

output "redis_port" {
  description = "Redis port number"
  value       = local.redis_port
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.main.id
}