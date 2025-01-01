# =============================================================================
# Stage 1: Build environment
# Node.js 20 Alpine base for minimal build environment
# =============================================================================
FROM node:20-alpine AS builder

# Security updates and build dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Environment setup
ENV NODE_ENV=production \
    PATH=/app/node_modules/.bin:$PATH \
    HUSKY=0

# Copy package files with integrity verification
COPY package*.json ./
COPY .npmrc ./

# Install dependencies with security audit
RUN npm ci --audit=true && \
    npm cache clean --force

# Copy source code with integrity checks
COPY . .

# Build production bundle with optimization flags
RUN npm run build:prod -- \
    --optimization=true \
    --sourceMap=false \
    --vendorChunk=true \
    --statsJson=true \
    --progress=false \
    --aot=true

# Validate build output
RUN test -d dist || exit 1

# =============================================================================
# Stage 2: Production environment
# Nginx Alpine base for minimal production footprint
# =============================================================================
FROM nginx:alpine

# Security updates and production dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    curl \
    tzdata \
    ca-certificates

# Create nginx user/group with minimal privileges
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist/saas-management-platform /usr/share/nginx/html

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl --fail http://localhost:80/health || exit 1

# Set security options
LABEL org.opencontainers.image.source="https://github.com/organization/saas-management-platform" \
      org.opencontainers.image.vendor="SaaS Management Platform" \
      org.opencontainers.image.title="Frontend Application" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.description="Angular-based SaaS Management Platform frontend"

# Security hardening
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024 \
    TZ=UTC

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]