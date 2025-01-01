variable "project_name" {
  type        = string
  description = "Name of the project used for resource naming and tagging"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Allow destruction of non-empty bucket. Default false for safety"
}

variable "versioning_enabled" {
  type        = bool
  default     = true
  description = "Enable versioning for the S3 bucket. Recommended for data protection"
}

variable "encryption_enabled" {
  type        = bool
  default     = true
  description = "Enable server-side encryption using AWS KMS"
}

variable "lifecycle_rules" {
  type = list(object({
    name    = string
    enabled = bool
    prefix  = string
    transitions = list(object({
      days          = number
      storage_class = string
    }))
    expiration = object({
      days = number
    })
  }))
  default     = []
  description = "List of lifecycle rules for object management including transitions and expiration"
}

variable "access_logging_enabled" {
  type        = bool
  default     = true
  description = "Enable access logging for bucket operations"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to be applied to all resources for organization and cost tracking"
}