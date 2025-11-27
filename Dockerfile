# Multi-stage build for optimized production image
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
# Use npm install if package-lock.json is missing, otherwise use npm ci for faster, reliable builds
RUN if [ -f package-lock.json ]; then \
      npm ci --only=production; \
    else \
      npm install --only=production; \
    fi

# Production stage
FROM node:22-slim

WORKDIR /usr/src/app

# Copy dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application code
COPY . .

# Environment variables with defaults
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=61327

# Expose port
EXPOSE 61327

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:61327/manifest.json', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run as non-root user
USER node

# Start server
CMD ["npm", "start"]

