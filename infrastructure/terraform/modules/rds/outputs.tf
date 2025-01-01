# Primary RDS instance connection details
output "primary_endpoint" {
  description = "Connection endpoint for the primary RDS instance"
  value       = aws_db_instance.main.endpoint
  sensitive   = false
}

output "primary_address" {
  description = "Network address of the primary RDS instance"
  value       = aws_db_instance.main.address
  sensitive   = false
}

output "primary_port" {
  description = "Port number on which the primary RDS instance accepts connections"
  value       = aws_db_instance.main.port
  sensitive   = false
}

# Read replica RDS instance connection details
output "replica_endpoint" {
  description = "Connection endpoint for the read replica RDS instance"
  value       = var.replica_enabled ? aws_db_instance_replica[0].endpoint : null
  sensitive   = false
}

output "replica_address" {
  description = "Network address of the read replica RDS instance"
  value       = var.replica_enabled ? aws_db_instance_replica[0].address : null
  sensitive   = false
}