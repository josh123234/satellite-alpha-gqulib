# AWS Provider configuration for API Gateway module
# Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common resource tagging
locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Main API Gateway REST API resource
resource "aws_api_gateway_rest_api" "main" {
  name = "${var.project_name}-${var.environment}"
  description = "API Gateway for SaaS Management Platform"

  endpoint_configuration {
    types = ["REGIONAL"]
    vpc_endpoint_ids = var.vpc_endpoint_ids
  }

  tags = local.common_tags

  # API Gateway resource policy
  policy = data.aws_iam_policy_document.api_gateway_policy.json
}

# API Gateway deployment stage with enhanced monitoring
resource "aws_api_gateway_stage" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = var.environment

  # Cache configuration
  cache_cluster_enabled = var.enable_caching
  cache_cluster_size   = var.enable_caching ? var.cache_size : null

  # X-Ray tracing configuration
  xray_tracing_enabled = var.xray_tracing_enabled

  # Access logging configuration
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      sourceIp               = "$context.identity.sourceIp"
      requestTime            = "$context.requestTime"
      protocol              = "$context.protocol"
      httpMethod            = "$context.httpMethod"
      resourcePath          = "$context.resourcePath"
      routeKey              = "$context.routeKey"
      status                = "$context.status"
      responseLength        = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
      }
    )
  }

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.api_gateway]
}

# Enhanced method settings with comprehensive monitoring
resource "aws_api_gateway_method_settings" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    # Metrics and logging
    metrics_enabled           = var.metrics_enabled
    logging_level            = var.logging_level
    data_trace_enabled       = var.data_trace_enabled

    # Throttling configuration
    throttling_burst_limit    = var.throttling_burst_limit
    throttling_rate_limit     = var.throttling_rate_limit

    # Cache settings
    caching_enabled                = var.enable_caching
    cache_ttl_in_seconds          = var.enable_caching ? var.cache_ttl : null
    require_authorization_for_cache_control = true
    unauthorized_cache_control_header_strategy = "SUCCEED_WITH_RESPONSE_HEADER"
  }
}

# CloudWatch log group for API Gateway access logs
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
  kms_key_id        = var.log_encryption_key_arn
}

# WAF Web ACL association with API Gateway
resource "aws_wafregional_web_acl_association" "main" {
  count = var.web_acl_id != null ? 1 : 0

  resource_arn = aws_api_gateway_stage.main.arn
  web_acl_id   = var.web_acl_id
}

# API Gateway domain name configuration with mutual TLS
resource "aws_api_gateway_domain_name" "main" {
  count = var.enable_mutual_tls ? 1 : 0

  domain_name = "${var.project_name}-api.${var.domain_name}"
  
  mutual_tls_authentication {
    truststore_uri     = "s3://${var.truststore_bucket}/${var.truststore_key}"
    truststore_version = var.truststore_version
  }

  security_policy = "TLS_1_2"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

# Outputs for other module references
output "rest_api_id" {
  description = "ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.main.id
}

output "execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.main.execution_arn
}

output "stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_api_gateway_stage.main.stage_name
}

output "invoke_url" {
  description = "URL to invoke the API Gateway"
  value       = aws_api_gateway_stage.main.invoke_url
}