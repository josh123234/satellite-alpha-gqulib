# Core outputs for the API Gateway module exposing essential resource information
# for use by other modules and root configuration

output "rest_api_id" {
  description = "ID of the created API Gateway REST API for resource references and IAM policies"
  value       = aws_api_gateway_rest_api.main.id
}

output "execution_arn" {
  description = "Execution ARN for the API Gateway stage, used for Lambda permissions and cross-service authentication"
  value       = aws_api_gateway_rest_api.main.execution_arn
}

output "api_endpoint" {
  description = "Base URL endpoint of the API Gateway stage for client configuration"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "stage_name" {
  description = "Name of the deployed API Gateway stage for environment identification"
  value       = aws_api_gateway_stage.main.stage_name
}

output "api_name" {
  description = "Name of the API Gateway REST API for resource tagging and monitoring"
  value       = aws_api_gateway_rest_api.main.name
}