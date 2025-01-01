# AWS WAF v2 Web ACL configuration for SaaS Management Platform
# Provider version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Environment      = var.environment
    SecurityComponent = "waf"
    LastUpdated     = timestamp()
  })
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  name        = "${local.name_prefix}-waf"
  description = "WAF rules for SaaS Management Platform with comprehensive protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # IP Rate-based rule
  rule {
    name     = "ip-rate-based-rule"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${local.name_prefix}-ip-rate-rule"
      sampled_requests_enabled  = true
    }
  }

  # AWS Managed Common Rule Set
  dynamic "rule" {
    for_each = var.enable_managed_rules ? ["enabled"] : []
    content {
      name     = "aws-managed-common"
      priority = 2

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesCommonRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "${local.name_prefix}-common-rules"
        sampled_requests_enabled  = true
      }
    }
  }

  # SQL Injection Protection
  dynamic "rule" {
    for_each = var.enable_managed_rules ? ["enabled"] : []
    content {
      name     = "aws-managed-sqli"
      priority = 3

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesSQLiRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "${local.name_prefix}-sqli-rules"
        sampled_requests_enabled  = true
      }
    }
  }

  # Known Bad Inputs Protection
  dynamic "rule" {
    for_each = var.enable_managed_rules ? ["enabled"] : []
    content {
      name     = "aws-managed-bad-inputs"
      priority = 4

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesKnownBadInputsRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "${local.name_prefix}-bad-inputs-rules"
        sampled_requests_enabled  = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${local.name_prefix}-waf-metrics"
    sampled_requests_enabled  = true
  }

  tags = local.common_tags
}

# IP Set for blocking
resource "aws_wafv2_ip_set" "blocked_ips" {
  name               = "${local.name_prefix}-blocked-ips"
  description        = "IP set for blocked addresses"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = []

  tags = local.common_tags
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count = var.enable_logging ? 1 : 0

  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]
  resource_arn           = aws_wafv2_web_acl.main.arn

  logging_filter {
    default_behavior = "KEEP"

    filter {
      behavior = "KEEP"
      condition {
        action_condition {
          action = "BLOCK"
        }
      }
      requirement = "MEETS_ANY"
    }
  }
}

# CloudWatch Log Group for WAF logs
resource "aws_cloudwatch_log_group" "waf" {
  count = var.enable_logging ? 1 : 0

  name              = "/aws/waf/${local.name_prefix}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

# Outputs
output "web_acl_id" {
  description = "The ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.id
}

output "web_acl_arn" {
  description = "The ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "web_acl_capacity" {
  description = "The capacity units currently used by the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.capacity
}

output "ip_set_id" {
  description = "The ID of the IP set used for blocking"
  value       = aws_wafv2_ip_set.blocked_ips.id
}

output "ip_set_arn" {
  description = "The ARN of the IP set used for blocking"
  value       = aws_wafv2_ip_set.blocked_ips.arn
}