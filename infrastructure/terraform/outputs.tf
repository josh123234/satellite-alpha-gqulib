# Terraform outputs file for SaaS Management Platform
# Version: ~> 1.5

# VPC and Networking Outputs
output "vpc_outputs" {
  description = "VPC and networking information"
  value = {
    vpc_id             = module.vpc.vpc_id
    private_subnet_ids = module.vpc.private_subnet_ids
    public_subnet_ids  = module.vpc.public_subnet_ids
  }
}

# ECS Cluster and Services Outputs
output "ecs_outputs" {
  description = "ECS cluster and service information"
  value = {
    cluster_arn    = module.ecs.cluster_arn
    service_names  = module.ecs.service_names
  }
}

# Database Outputs
output "database_outputs" {
  description = "Database connection endpoints and information"
  sensitive   = true
  value = {
    primary_endpoint     = module.rds.primary_endpoint
    replica_endpoint     = module.rds.replica_endpoint
    documentdb_endpoint  = module.rds.documentdb_endpoint
  }
}

# Cache Cluster Outputs
output "cache_outputs" {
  description = "Cache cluster connection information"
  sensitive   = true
  value = {
    redis_endpoint = module.elasticache.redis_endpoint
    redis_port     = module.elasticache.redis_port
  }
}

# Security Resource Outputs
output "security_outputs" {
  description = "Security-related resource information"
  sensitive   = true
  value = {
    ecs_task_role_arn     = module.security.ecs_task_role_arn
    app_security_group_id = module.security.app_security_group_id
    kms_key_id           = module.security.kms_key_id
  }
}

# CDN Outputs
output "cdn_outputs" {
  description = "CloudFront distribution information"
  value = {
    distribution_id = module.cloudfront.distribution_id
    domain_name     = module.cloudfront.domain_name
  }
}

# Monitoring and Logging Outputs
output "monitoring_outputs" {
  description = "Monitoring and logging resource information"
  value = {
    log_group_names = module.monitoring.log_group_names
    alarm_topic_arn = module.monitoring.alarm_topic_arn
  }
}