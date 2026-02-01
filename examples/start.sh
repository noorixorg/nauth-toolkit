#!/bin/bash
# Auto-generate .env with secrets if it doesn't exist

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "No .env found - generating from .env.example..."
    echo ""
    cp .env.example "$ENV_FILE"

    # Generate secrets
    DB_PASS=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-32)
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH=$(openssl rand -base64 32)

    # Update .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|DB_PASSWORD=|DB_PASSWORD=${DB_PASS}|g" "$ENV_FILE"
        sed -i '' "s|JWT_SECRET=|JWT_SECRET=${JWT_SECRET}|g" "$ENV_FILE"
        sed -i '' "s|JWT_REFRESH_SECRET=|JWT_REFRESH_SECRET=${JWT_REFRESH}|g" "$ENV_FILE"
    else
        # Linux
        sed -i "s|DB_PASSWORD=|DB_PASSWORD=${DB_PASS}|g" "$ENV_FILE"
        sed -i "s|JWT_SECRET=|JWT_SECRET=${JWT_SECRET}|g" "$ENV_FILE"
        sed -i "s|JWT_REFRESH_SECRET=|JWT_REFRESH_SECRET=${JWT_REFRESH}|g" "$ENV_FILE"
    fi

    echo "✓ .env created with auto-generated secrets"
    echo ""
else
    echo "✓ Using existing .env (not overwriting)"
    echo ""
fi

# Start docker-compose
echo "Starting services..."
docker-compose up -d "$@"
