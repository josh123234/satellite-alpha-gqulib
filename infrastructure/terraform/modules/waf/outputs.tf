# WAF Web ACL outputs for integration with other AWS resources and security monitoring
# These outputs expose critical WAF configuration details for use in other Terraform modules

output "web_acl_id" {
  description = "ID of the WAF Web ACL for association with ALB and API Gateway resources"
  value       = aws_wafv2_web_acl.main.id
  sensitive   = false
}

output "web_acl_arn" {
  description = "ARN of the WAF Web ACL for IAM policies, CloudWatch metrics, and resource associations"
  value       = aws_wafv2_web_acl.main.arn
  sensitive   = false
}

output "web_acl_name" {
  description = "Name of the WAF Web ACL for reference in configurations and monitoring setup"
  value       = aws_wafv2_web_acl.main.name
  sensitive   = false
}

output "web_acl_capacity" {
  description = "Current capacity units used by the WAF Web ACL for monitoring and scaling decisions"
  value       = aws_wafv2_web_acl.main.capacity
  sensitive   = false
}