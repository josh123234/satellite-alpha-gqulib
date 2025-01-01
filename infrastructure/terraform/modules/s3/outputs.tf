# Output the S3 bucket identifier
# Marked as sensitive to prevent exposure in logs
output "bucket_id" {
  description = "The unique identifier of the created S3 bucket"
  value       = aws_s3_bucket.this.id
  sensitive   = true
}

# Output the S3 bucket ARN for IAM policy configuration
# Marked as sensitive since ARNs can expose infrastructure details
output "bucket_arn" {
  description = "The ARN of the created S3 bucket for IAM policy configuration"
  value       = aws_s3_bucket.this.arn
  sensitive   = true
}

# Output the S3 bucket domain name for endpoint access
output "bucket_domain_name" {
  description = "The domain name of the created S3 bucket for endpoint access"
  value       = aws_s3_bucket.this.bucket_domain_name
}

# Output the S3 bucket regional domain name for region-specific access
output "bucket_regional_domain_name" {
  description = "The regional domain name of the created S3 bucket for region-specific endpoint access"
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}

# Output the KMS key ARN used for bucket encryption
# Marked as sensitive since it's a security-critical resource
output "kms_key_arn" {
  description = "The ARN of the KMS key used for bucket encryption"
  value       = aws_kms_key.s3.arn
  sensitive   = true
}

# Output the logging bucket details if access logging is enabled
output "logging_bucket_id" {
  description = "The ID of the access logging bucket (if enabled)"
  value       = var.access_logging_enabled ? aws_s3_bucket.logs[0].id : null
  sensitive   = true
}

output "logging_bucket_arn" {
  description = "The ARN of the access logging bucket (if enabled)"
  value       = var.access_logging_enabled ? aws_s3_bucket.logs[0].arn : null
  sensitive   = true
}