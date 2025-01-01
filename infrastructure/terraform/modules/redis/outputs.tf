# Primary endpoint for Redis cluster write operations
output "redis_primary_endpoint" {
  description = "Primary endpoint address for Redis cluster write operations"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

# Reader endpoint for Redis cluster read operations
output "redis_reader_endpoint" {
  description = "Reader endpoint address for Redis cluster read operations"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

# Port number for Redis cluster access
output "redis_port" {
  description = "Port number for Redis cluster access"
  value       = aws_elasticache_replication_group.main.port
}

# Security group ID for Redis cluster network access
output "redis_security_group_id" {
  description = "Security group ID for Redis cluster network access"
  value       = aws_security_group.main.id
}

# Formatted connection string for application configuration
output "redis_connection_string" {
  description = "Formatted connection string for application configuration"
  value       = format("redis://%s:%s", aws_elasticache_replication_group.main.primary_endpoint_address, aws_elasticache_replication_group.main.port)
}