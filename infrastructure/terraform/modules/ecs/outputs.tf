# ECS Cluster outputs
output "cluster_id" {
  description = "The ID of the ECS cluster for service and task deployments"
  value       = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  description = "The ARN of the ECS cluster for cross-AZ deployments and IAM policies"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "The name of the ECS cluster for resource identification and logging"
  value       = aws_ecs_cluster.main.name
}

# IAM Role outputs
output "task_execution_role_arn" {
  description = "The ARN of the task execution role for ECS task definitions"
  value       = aws_iam_role.task_execution_role.arn
}

output "task_role_arn" {
  description = "The ARN of the task role for ECS task application permissions"
  value       = aws_iam_role.task_role.arn
}

# Security Group output
output "task_security_group_id" {
  description = "The ID of the security group for ECS tasks network access control"
  value       = aws_security_group.ecs_tasks.id
}