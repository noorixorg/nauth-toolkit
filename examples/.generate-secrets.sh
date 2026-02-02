#!/bin/bash
# Auto-generate .env with secrets if it doesn't exist

if [ ! -f .env ]; then
    echo "Generating .env with secure secrets..."
    cp .env.example .env

    # Generate secrets
    DB_PASS=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-32)
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH=$(openssl rand -base64 32)

    # Update .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|DB_PASSWORD=|DB_PASSWORD=${DB_PASS}|g" .env
        sed -i '' "s|JWT_SECRET=|JWT_SECRET=${JWT_SECRET}|g" .env
        sed -i '' "s|JWT_REFRESH_SECRET=|JWT_REFRESH_SECRET=${JWT_REFRESH}|g" .env
    else
        # Linux
        sed -i "s|DB_PASSWORD=|DB_PASSWORD=${DB_PASS}|g" .env
        sed -i "s|JWT_SECRET=|JWT_SECRET=${JWT_SECRET}|g" .env
        sed -i "s|JWT_REFRESH_SECRET=|JWT_REFRESH_SECRET=${JWT_REFRESH}|g" .env
    fi

    echo "✓ .env created with generated secrets"
    echo ""
else
    echo ".env already exists, skipping generation"
fi

# Start docker-compose
echo "Starting services..."
docker-compose up -d "$@"
