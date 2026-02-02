# Docker Deployment

This directory contains Docker configuration for deploying the Nauth demo applications.

## Quick Start

```bash
# Run the setup script
./docker-setup.sh

# Or manually:
cp .env.example .env
# Edit .env with your configuration
docker-compose up -d
```

## What's Included

- **NestJS Backend** - Sample authentication API
- **Angular Frontend** - Sample web application
- **PostgreSQL** - Database
- **Redis** - Session storage

## Configuration

All configuration is managed through environment variables in `.env` file.

### Minimum Required Configuration

```bash
FRONTEND_BASE_URL=https://demo.yourdomain.com
API_BASE_URL=https://api.demo.yourdomain.com
PASSKEY_RP_ID=demo.yourdomain.com
COOKIE_DOMAIN=.demo.yourdomain.com
JWT_SECRET=your-generated-secret
JWT_REFRESH_SECRET=your-generated-secret
DB_PASSWORD=your-secure-password
```

### Generate Secrets

```bash
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
```

## Usage

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose build
docker-compose up -d
```

## Services

### Frontend (Angular)

- **Port:** 4200 (mapped to 80 inside container)
- **URL:** Set via `FRONTEND_BASE_URL`
- **Health:** http://localhost:4200/health

### Backend (NestJS)

- **Port:** 3000
- **URL:** Set via `API_BASE_URL`
- **Health:** http://localhost:3000/health

### PostgreSQL

- **Port:** 5432
- **Database:** nauth_sample
- **User:** nauth_user
- **Password:** Set via `DB_PASSWORD`

### Redis

- **Port:** 6379
- **URL:** redis://redis:6379

## Production Deployment

For production deployment with SSL/TLS:

```bash
# Start with proxy manager
docker-compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
```

Then configure SSL certificates through Nginx Proxy Manager web interface at http://localhost:81

## Documentation

See [DOCKER_DEPLOYMENT.md](../DOCKER_DEPLOYMENT.md) for comprehensive documentation including:

- Detailed configuration guide
- Domain setup instructions
- OAuth provider configuration
- SSL/TLS setup
- Troubleshooting
- Production considerations

## Support

For issues or questions, see the main documentation or open an issue on GitHub.
