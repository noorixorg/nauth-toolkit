# Angular frontend - build args from examples/docker-compose.yml (values from examples/.env)
# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Replace all @nauth-toolkit/* deps with latest npm versions for Docker build
RUN sed -i 's/"@nauth-toolkit\/\([^"]*\)": "[^"]*"/"@nauth-toolkit\/\1": "latest"/g' package.json

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build arguments for environment configuration (from docker-compose frontend build args)
# ARG name -> environment.prod.ts property (must match Environment interface)
# API_BASE_URL -> apiBaseUrl
# RECAPTCHA_SITE_KEY -> recaptchaSiteKey (compose passes RECAPTCHA_ENTERPRISE_SITE_KEY)
# RECAPTCHA_VERSION -> recaptchaVersion
# RECAPTCHA_ENABLED -> recaptchaEnabled
# TOKEN_MODE -> tokenMode
# SHOW_APPLE_LOGIN -> showAppleLogin
# SHOW_FACEBOOK_LOGIN -> showFacebookLogin
ARG API_BASE_URL=https://demo.nauth.dev/api
ARG RECAPTCHA_SITE_KEY
ARG RECAPTCHA_VERSION=enterprise
ARG RECAPTCHA_ENABLED=true
ARG TOKEN_MODE=cookies
ARG SHOW_APPLE_LOGIN=true
ARG SHOW_FACEBOOK_LOGIN=true

# Create environment file from build args (must match Environment interface)
RUN echo "import type { Environment } from './environment.interface';" > src/environments/environment.prod.ts && \
    echo "export const environment: Environment = {" >> src/environments/environment.prod.ts && \
    echo "  production: true," >> src/environments/environment.prod.ts && \
    echo "  apiBaseUrl: '${API_BASE_URL}'," >> src/environments/environment.prod.ts && \
    echo "  recaptchaSiteKey: '${RECAPTCHA_SITE_KEY}'," >> src/environments/environment.prod.ts && \
    echo "  recaptchaVersion: '${RECAPTCHA_VERSION}' as 'v3' | 'enterprise'," >> src/environments/environment.prod.ts && \
    echo "  tokenMode: '${TOKEN_MODE}' as 'cookies' | 'json'," >> src/environments/environment.prod.ts && \
    echo "  recaptchaEnabled: ${RECAPTCHA_ENABLED}," >> src/environments/environment.prod.ts && \
    echo "  showAppleLogin: ${SHOW_APPLE_LOGIN}," >> src/environments/environment.prod.ts && \
    echo "  showFacebookLogin: ${SHOW_FACEBOOK_LOGIN}," >> src/environments/environment.prod.ts && \
    echo "};" >> src/environments/environment.prod.ts

# Build Angular app
RUN npm run build -- --configuration production

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
