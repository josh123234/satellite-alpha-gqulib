# AWS Provider configuration with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "${var.project}-${var.environment}"
}

# Main VPC resource
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = local.name_prefix
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# Public subnets - one per AZ
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block             = var.public_subnet_cidrs[count.index]
  availability_zone      = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = format("%s-public-%s", local.name_prefix, var.azs[count.index])
    Type        = "public"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Private subnets - one per AZ
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.azs[count.index]

  tags = {
    Name        = format("%s-private-%s", local.name_prefix, var.azs[count.index])
    Type        = "private"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Internet Gateway for public subnet internet access
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = local.name_prefix
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = length(var.public_subnet_cidrs)
  domain = "vpc"

  tags = {
    Name        = format("%s-nat-%s", local.name_prefix, var.azs[count.index])
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# NAT Gateways - one per AZ for high availability
resource "aws_nat_gateway" "main" {
  count         = length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = format("%s-nat-%s", local.name_prefix, var.azs[count.index])
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Route table for public subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = format("%s-public", local.name_prefix)
    Type        = "public"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Route tables for private subnets - one per AZ
resource "aws_route_table" "private" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name        = format("%s-private-%s", local.name_prefix, var.azs[count.index])
    Type        = "private"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Associate public subnets with public route table
resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Associate private subnets with corresponding private route tables
resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Output the VPC ID
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

# Output private subnet IDs
output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

# Output public subnet IDs
output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}