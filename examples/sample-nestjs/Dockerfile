# NestJS backend - no build args; runtime config from docker-compose environment (examples/.env)
# Build stage
FROM node:24-alpine AS builder

# Install dependencies for building
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json ./

# Pin all @nauth-toolkit/* deps to latest so Docker always pulls the newest release
RUN sed -i 's/"@nauth-toolkit\/\([^"]*\)": "[^"]*"/"@nauth-toolkit\/\1": "latest"/g' package.json

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:24-alpine AS production

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Create app directory with correct ownership
RUN mkdir -p /app && chown nestjs:nodejs /app

WORKDIR /app

USER nestjs

# Copy package files with ownership
COPY --chown=nestjs:nodejs package.json ./

# Pin all @nauth-toolkit/* deps to latest so Docker always pulls the newest release
RUN sed -i 's/"@nauth-toolkit\/\([^"]*\)": "[^"]*"/"@nauth-toolkit\/\1": "latest"/g' package.json

# Install production dependencies (peer deps e.g. qrcode come from package.json)
RUN npm install --legacy-peer-deps --omit=dev --include=optional

# Copy built application from builder with ownership
COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist
COPY --chown=nestjs:nodejs --from=builder /app/resources ./resources
COPY --chown=nestjs:nodejs --from=builder /app/maxmind ./maxmind

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
