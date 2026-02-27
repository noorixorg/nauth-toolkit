#!/bin/bash

# Nauth Docker Setup Script
# This script helps you quickly set up the Nauth demo environment

set -e

echo "=================================================="
echo "Nauth Toolkit - Docker Setup"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ -f .env ]; then
    echo -e "${YELLOW}Warning: .env file already exists.${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file."
        ENV_EXISTS=true
    fi
fi

# Create .env from example if it doesn't exist or user wants to overwrite
if [ "$ENV_EXISTS" != "true" ]; then
    if [ ! -f .env.example ]; then
        echo -e "${RED}Error: .env.example not found!${NC}"
        exit 1
    fi

    echo "Creating .env file from .env.example..."
    cp .env.example .env

    echo ""
    echo "=================================================="
    echo "Environment Configuration"
    echo "=================================================="
    echo ""

    # Prompt for domain configuration
    read -p "Enter your frontend domain (e.g., demo.yourdomain.com): " FRONTEND_DOMAIN
    read -p "Enter your API domain (e.g., api.demo.yourdomain.com): " API_DOMAIN

    # Determine protocol
    if [[ "$FRONTEND_DOMAIN" == "localhost"* ]] || [[ "$FRONTEND_DOMAIN" == "127.0.0.1"* ]]; then
        FRONTEND_PROTOCOL="http"
        API_PROTOCOL="http"
    else
        FRONTEND_PROTOCOL="https"
        API_PROTOCOL="https"
    fi

    FRONTEND_BASE_URL="${FRONTEND_PROTOCOL}://${FRONTEND_DOMAIN}"
    API_BASE_URL="${API_PROTOCOL}://${API_DOMAIN}"

    # Extract base domain for passkey RP ID
    PASSKEY_RP_ID=$(echo "$FRONTEND_DOMAIN" | sed -E 's/^[^.]+\.(.+)$/\1/')
    if [ "$PASSKEY_RP_ID" = "$FRONTEND_DOMAIN" ]; then
        PASSKEY_RP_ID="$FRONTEND_DOMAIN"
    fi

    # Determine cookie domain
    if [[ "$FRONTEND_DOMAIN" == "$API_DOMAIN" ]]; then
        COOKIE_DOMAIN=""
    else
        # Extract base domain
        BASE_DOMAIN=$(echo "$FRONTEND_DOMAIN" | sed -E 's/^[^.]+\.(.+)$/\1/')
        if [ "$BASE_DOMAIN" = "$FRONTEND_DOMAIN" ]; then
            COOKIE_DOMAIN=""
        else
            COOKIE_DOMAIN=".${BASE_DOMAIN}"
        fi
    fi

    # Generate JWT secrets
    echo ""
    echo "Generating JWT secrets..."
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)

    # Generate database password
    DB_PASSWORD=$(openssl rand -base64 24)

    # Update .env file
    sed -i.bak "s|FRONTEND_BASE_URL=.*|FRONTEND_BASE_URL=${FRONTEND_BASE_URL}|g" .env
    sed -i.bak "s|API_BASE_URL=.*|API_BASE_URL=${API_BASE_URL}|g" .env
    sed -i.bak "s|PASSKEY_RP_ID=.*|PASSKEY_RP_ID=${PASSKEY_RP_ID}|g" .env
    sed -i.bak "s|COOKIE_DOMAIN=.*|COOKIE_DOMAIN=${COOKIE_DOMAIN}|g" .env
    sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env
    sed -i.bak "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|g" .env
    sed -i.bak "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|g" .env

    rm .env.bak

    echo -e "${GREEN}✓ Environment file created successfully!${NC}"
    echo ""
    echo "Configuration:"
    echo "  Frontend URL: ${FRONTEND_BASE_URL}"
    echo "  API URL: ${API_BASE_URL}"
    echo "  Passkey RP ID: ${PASSKEY_RP_ID}"
    echo "  Cookie Domain: ${COOKIE_DOMAIN:-'(none - same domain)'}"
    echo "  Database Password: ${DB_PASSWORD}"
    echo ""
fi

# Ask about OAuth providers
echo "=================================================="
echo "OAuth Providers (Optional)"
echo "=================================================="
echo ""
echo "You can configure social OAuth providers now or later."
echo "To skip, just press Enter for each prompt."
echo ""

read -p "Configure OAuth providers now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Google OAuth:"
    read -p "  Client ID: " GOOGLE_CLIENT_ID
    read -p "  Client Secret: " GOOGLE_CLIENT_SECRET

    if [ -n "$GOOGLE_CLIENT_ID" ]; then
        sed -i.bak "s|GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}|g" .env
        sed -i.bak "s|GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}|g" .env
        rm .env.bak
    fi

    echo ""
    echo "Facebook OAuth:"
    read -p "  App ID: " FACEBOOK_CLIENT_ID
    read -p "  App Secret: " FACEBOOK_CLIENT_SECRET

    if [ -n "$FACEBOOK_CLIENT_ID" ]; then
        sed -i.bak "s|FACEBOOK_CLIENT_ID=.*|FACEBOOK_CLIENT_ID=${FACEBOOK_CLIENT_ID}|g" .env
        sed -i.bak "s|FACEBOOK_CLIENT_SECRET=.*|FACEBOOK_CLIENT_SECRET=${FACEBOOK_CLIENT_SECRET}|g" .env
        rm .env.bak
    fi
fi

echo ""
echo "=================================================="
echo "Building Docker Images"
echo "=================================================="
echo ""

# Build images
echo "Building images (this may take several minutes)..."
docker-compose build

echo ""
echo -e "${GREEN}✓ Docker images built successfully!${NC}"
echo ""

# Ask to start services
read -p "Start all services now? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "Starting services..."
    docker-compose up -d

    echo ""
    echo "Waiting for services to be healthy..."
    sleep 10

    # Check service status
    docker-compose ps

    echo ""
    echo -e "${GREEN}✓ Setup complete!${NC}"
    echo ""
    echo "=================================================="
    echo "Access Your Applications"
    echo "=================================================="
    echo ""
    echo "Frontend: ${FRONTEND_BASE_URL}"
    echo "Backend API: ${API_BASE_URL}"
    echo "Backend Health: ${API_BASE_URL}/health"
    echo ""
    echo "Default Ports (if using localhost):"
    echo "  Frontend: http://localhost:4200"
    echo "  Backend: http://localhost:3000"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis: localhost:6379"
    echo ""
    echo "=================================================="
    echo "Useful Commands"
    echo "=================================================="
    echo ""
    echo "View logs:        docker-compose logs -f"
    echo "Stop services:    docker-compose down"
    echo "Restart service:  docker-compose restart backend"
    echo "View status:      docker-compose ps"
    echo ""
    echo "For more information, see DOCKER_DEPLOYMENT.md"
    echo ""
else
    echo ""
    echo "Setup complete! To start services, run:"
    echo "  docker-compose up -d"
    echo ""
fi
