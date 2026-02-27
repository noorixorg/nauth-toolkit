# Docker Deployment Guide

Complete guide for deploying the Nauth demo applications using Docker.

## Quick Start

```bash
# 1. Clone and navigate to repository
cd /path/to/nauth-toolkit

# 2. Create environment file
cp .env.example .env

# 3. Edit .env with your configuration
nano .env  # or use your preferred editor

# 4. Generate JWT secrets
openssl rand -base64 32  # Copy to JWT_SECRET
openssl rand -base64 32  # Copy to JWT_REFRESH_SECRET

# 5. Build and start all services
docker-compose up -d

# 6. View logs
docker-compose logs -f

# 7. Check service health
docker-compose ps
```

## Architecture

The Docker setup includes:

- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Session storage
- **NestJS Backend** (port 3000) - API server
- **Angular Frontend** (port 4200/80) - Web application

All services are connected via Docker network and include health checks.

## Configuration

### Required Environment Variables

Edit `.env` and configure these **required** variables:

```bash
# Domain Configuration (CRITICAL)
FRONTEND_BASE_URL=https://demo.yourdomain.com
API_BASE_URL=https://api.demo.yourdomain.com
PASSKEY_RP_ID=demo.yourdomain.com
COOKIE_DOMAIN=.demo.yourdomain.com

# Database (Change password!)
DB_PASSWORD=your_secure_password_here

# JWT Secrets (Generate new ones!)
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
```

### Optional Environment Variables

Social OAuth providers are **optional** and will be disabled if not configured:

```bash
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret

# Apple OAuth (optional)
APPLE_SERVICE_ID=com.yourapp.services
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_P8_KEY="-----BEGIN PRIVATE KEY-----..."

# Facebook OAuth (optional)
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
```

## Domain Configuration Explained

### Single Domain Setup (Simplest)

If frontend and backend are on the same domain:

```bash
FRONTEND_BASE_URL=https://demo.yourdomain.com
API_BASE_URL=https://demo.yourdomain.com/api
PASSKEY_RP_ID=demo.yourdomain.com
COOKIE_DOMAIN=  # Leave empty
```

Use a reverse proxy to route `/api/*` to backend container.

### Subdomain Setup (Recommended)

If using separate subdomains for frontend and backend:

```bash
FRONTEND_BASE_URL=https://demo.yourdomain.com
API_BASE_URL=https://api.demo.yourdomain.com
PASSKEY_RP_ID=demo.yourdomain.com
COOKIE_DOMAIN=.demo.yourdomain.com  # Note the leading dot
```

**Important:**

- Must use HTTPS in production
- Cookie domain needs leading dot (`.demo.yourdomain.com`)
- Passkey RP ID is the frontend domain without protocol

### OAuth Callback URLs

Update your OAuth provider settings with correct callback URLs:

```bash
# Google Console
https://api.demo.yourdomain.com/auth/social/google/callback

# Apple Developer Portal
https://api.demo.yourdomain.com/social/apple/callback

# Facebook App Dashboard
https://api.demo.yourdomain.com/auth/social/facebook/callback
```

## Building and Running

### Development/Testing

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down
```

### Production Deployment

```bash
# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

# View status
docker-compose ps

# Scale backend if needed
docker-compose up -d --scale backend=3
```

### Clean Slate Rebuild

```bash
# Stop and remove everything including volumes
docker-compose down -v

# Rebuild images from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

## Service Management

### Check Service Health

```bash
# All services
docker-compose ps

# Backend health
curl http://localhost:3000/health

# Frontend health
curl http://localhost:4200/health
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Database Access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U nauth_user -d nauth_sample

# Backup database
docker-compose exec postgres pg_dump -U nauth_user nauth_sample > backup.sql

# Restore database
docker-compose exec -T postgres psql -U nauth_user -d nauth_sample < backup.sql
```

### Redis Access

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Common Redis commands
KEYS *           # List all keys
GET key          # Get value
FLUSHALL         # Clear all data (careful!)
```

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database not ready - wait for postgres healthcheck
# 2. Missing JWT secrets - check .env file
# 3. Redis connection failed - check redis service

# Restart backend
docker-compose restart backend
```

### Frontend build fails

```bash
# Check logs
docker-compose logs frontend

# Common issues:
# 1. Missing API_BASE_URL build arg
# 2. Node memory issue - increase Docker memory limit

# Rebuild frontend
docker-compose build --no-cache frontend
```

### Database connection failed

```bash
# Check postgres is running
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U nauth_user
```

### Cookies not working

Check these settings:

1. **HTTPS Required**: Cross-domain cookies need HTTPS in production
2. **Cookie Domain**: Must match your domain structure
3. **Browser Settings**: Check if third-party cookies are blocked
4. **CORS**: Ensure backend allows your frontend origin

### OAuth Callbacks Failing

1. **Callback URLs**: Must match exactly in provider settings
2. **HTTPS**: Most providers require HTTPS callbacks (except localhost)
3. **Credentials**: Double-check client ID and secret
4. **Environment Variables**: Ensure they're loaded correctly

## Production Considerations

### Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Generate new JWT secrets
- [ ] Enable HTTPS (required for cookies)
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper cookie domain
- [ ] Review and lock down database access
- [ ] Set up regular database backups
- [ ] Configure firewall rules
- [ ] Enable reCAPTCHA for production

### Performance

```bash
# Monitor resource usage
docker stats

# Scale backend instances
docker-compose up -d --scale backend=3

# Add a load balancer (Nginx/Traefik) in front
```

### SSL/TLS Setup

For production, use a reverse proxy with SSL:

**Option 1: Nginx Proxy Manager** (Recommended for beginners)

```bash
# Add to docker-compose.yml
nginx-proxy-manager:
  image: jc21/nginx-proxy-manager:latest
  ports:
    - "80:80"
    - "443:443"
    - "81:81"
  volumes:
    - npm-data:/data
    - npm-ssl:/etc/letsencrypt
```

**Option 2: Traefik** (Recommended for auto SSL)

```bash
# Add to docker-compose.yml
traefik:
  image: traefik:v2.10
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - ./traefik.yml:/traefik.yml
```

### Database Backups

Add automated backups:

```bash
# Cron job for daily backups
0 2 * * * docker-compose exec postgres pg_dump -U nauth_user nauth_sample | gzip > /backups/nauth_$(date +\%Y\%m\%d).sql.gz
```

### Monitoring

Consider adding monitoring:

```bash
# Prometheus + Grafana
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

## Updating

### Update Docker Images

```bash
# Pull latest base images
docker-compose pull

# Rebuild with new changes
docker-compose build

# Restart services
docker-compose up -d
```

### Update Application Code

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose build

# Restart with new code
docker-compose up -d
```

## Useful Commands

```bash
# Remove all stopped containers
docker-compose rm

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# View container resource usage
docker stats

# Execute command in container
docker-compose exec backend yarn --version

# Shell access to container
docker-compose exec backend sh
docker-compose exec frontend sh
```

## Environment Variables Reference

See `.env.example` for complete list of available environment variables.

### Core Variables

| Variable             | Required | Default | Description              |
| -------------------- | -------- | ------- | ------------------------ |
| `FRONTEND_BASE_URL`  | Yes      | -       | Frontend application URL |
| `API_BASE_URL`       | Yes      | -       | Backend API URL          |
| `JWT_SECRET`         | Yes      | -       | JWT signing secret       |
| `JWT_REFRESH_SECRET` | Yes      | -       | Refresh token secret     |
| `DB_PASSWORD`        | Yes      | -       | Database password        |

### Domain Variables

| Variable        | Required    | Default   | Description                           |
| --------------- | ----------- | --------- | ------------------------------------- |
| `PASSKEY_RP_ID` | Yes         | localhost | Passkey relying party ID              |
| `COOKIE_DOMAIN` | Conditional | -         | Cookie domain (needed for subdomains) |

### Social OAuth (All Optional)

| Variable               | Required | Description                |
| ---------------------- | -------- | -------------------------- |
| `GOOGLE_CLIENT_ID`     | No       | Google OAuth client ID     |
| `GOOGLE_CLIENT_SECRET` | No       | Google OAuth client secret |
| `APPLE_SERVICE_ID`     | No       | Apple Services ID          |
| `FACEBOOK_CLIENT_ID`   | No       | Facebook App ID            |

## Support

For issues or questions:

1. Check logs: `docker-compose logs -f`
2. Verify environment: `docker-compose config`
3. Check service health: `docker-compose ps`
4. Review this guide
5. Open an issue on GitHub

## License

See LICENSE file in repository root.
