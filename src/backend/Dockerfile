# Stage 1: Builder
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code and configuration files
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# Remove build dependencies
RUN apk del python3 make g++

# Stage 2: Production
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy production dependencies and built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app && \
    chmod -R 555 /app && \
    chmod -R 444 /app/dist && \
    chmod -R 444 /app/package*.json

# Install curl for health check
RUN apk add --no-cache curl

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Drop all capabilities and set security limits
RUN setcap 'cap_net_bind_service=+ep' $(which node)

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Define startup command
CMD ["node", "dist/main"]

# Set resource limits
LABEL com.docker.resource.memory="1GB" \
      com.docker.resource.cpu="1.0"

# Security labels
LABEL org.opencontainers.image.security.caps="drop-all" \
      org.opencontainers.image.security.readonly="true"