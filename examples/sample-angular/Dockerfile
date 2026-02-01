# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build arguments for environment configuration
ARG API_BASE_URL
ARG RECAPTCHA_SITE_KEY
ARG RECAPTCHA_VERSION=enterprise

# Create environment file from build args
RUN echo "export const environment = {" > src/environments/environment.prod.ts && \
    echo "  production: true," >> src/environments/environment.prod.ts && \
    echo "  apiBaseUrl: '${API_BASE_URL}'," >> src/environments/environment.prod.ts && \
    echo "  recaptchaSiteKey: '${RECAPTCHA_SITE_KEY}'," >> src/environments/environment.prod.ts && \
    echo "  recaptchaVersion: '${RECAPTCHA_VERSION}' as 'v3' | 'enterprise'," >> src/environments/environment.prod.ts && \
    echo "};" >> src/environments/environment.prod.ts

# Build Angular app
RUN yarn build --configuration production

# Production stage with Nginx
FROM nginx:alpine AS production

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built Angular app
COPY --from=builder /app/dist/sample-angular/browser /usr/share/nginx/html

# Create non-root user and set permissions
RUN addgroup -g 1001 -S angular && \
    adduser -S angular -u 1001 && \
    chown -R angular:angular /usr/share/nginx/html && \
    chown -R angular:angular /var/cache/nginx && \
    chown -R angular:angular /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R angular:angular /var/run/nginx.pid

USER angular

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
