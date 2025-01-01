variable "project_name" {
  description = "Name of the project used for WAF resource naming and tagging"
  type        = string
  default     = "saas-management-platform"
}

variable "environment" {
  description = "Deployment environment identifier for environment-specific WAF configurations"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "rate_limit" {
  description = "Maximum number of requests allowed per 5-minute period per IP address"
  type        = number
  default     = 2000
  validation {
    condition     = var.rate_limit >= 100 && var.rate_limit <= 10000
    error_message = "Rate limit must be between 100 and 10000 requests"
  }
}

variable "block_period" {
  description = "Duration in minutes to block IP addresses that exceed the rate limit"
  type        = number
  default     = 240
  validation {
    condition     = var.block_period >= 5 && var.block_period <= 1440
    error_message = "Block period must be between 5 and 1440 minutes"
  }
}

variable "log_retention_days" {
  description = "Number of days to retain WAF logs in CloudWatch"
  type        = number
  default     = 30
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period"
  }
}

variable "enable_logging" {
  description = "Enable WAF logging to CloudWatch Logs for security monitoring and analysis"
  type        = bool
  default     = true
}

variable "enable_managed_rules" {
  description = "Enable AWS managed rule sets for protection against common web vulnerabilities"
  type        = bool
  default     = true
}

variable "managed_rule_groups" {
  description = "List of AWS managed rule groups to enable with their override configurations"
  type = map(object({
    enabled         = bool
    override_action = string
    excluded_rules  = list(string)
  }))
  default = {
    AWSManagedRulesCommonRuleSet = {
      enabled         = true
      override_action = "none"
      excluded_rules  = []
    }
    AWSManagedRulesKnownBadInputsRuleSet = {
      enabled         = true
      override_action = "none"
      excluded_rules  = []
    }
    AWSManagedRulesSQLiRuleSet = {
      enabled         = true
      override_action = "none"
      excluded_rules  = []
    }
  }
}

variable "ip_rate_based_rule" {
  description = "Configuration for IP-based rate limiting rule"
  type = object({
    enabled = bool
    limit   = number
    action  = string
  })
  default = {
    enabled = true
    limit   = 2000
    action  = "block"
  }
}

variable "tags" {
  description = "Tags to apply to all WAF resources for resource management and cost allocation"
  type        = map(string)
  default = {
    Project       = "saas-management-platform"
    ManagedBy     = "terraform"
    SecurityLayer = "waf"
  }
}