#!/bin/bash
# setup-ssl.sh - Setup Let's Encrypt SSL certificate

set -e

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup-ssl.sh your-domain.com [email@example.com]"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-"admin@$DOMAIN"}

echo "=== Setting up SSL for $DOMAIN ==="

# Create certbot directories
mkdir -p certbot/conf certbot/www

# Stop existing containers
docker-compose down

# Start only nginx (needed for certbot challenge)
docker-compose up -d frontend

# Wait for nginx to start
sleep 5

# Get certificate (staging first for testing)
echo "=== Getting SSL certificate from Let's Encrypt ==="
docker run --rm \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Check if certificate was obtained
if [ -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "=== SSL certificate obtained successfully! ==="
    
    # Update nginx.conf to enable HTTPS
    echo ""
    echo "Now update web/nginx.conf:"
    echo "1. Uncomment the HTTPS server block"
    echo "2. Replace 'your-domain.com' with '$DOMAIN'"
    echo "3. Uncomment the 'return 301' redirect in the HTTP block"
    echo "4. Comment out the HTTP serving section"
    echo ""
    echo "Then rebuild and restart:"
    echo "  docker-compose down"
    echo "  docker-compose up -d --build"
    echo ""
    echo "For auto-renewal, run:"
    echo "  docker-compose --profile ssl up -d certbot"
else
    echo "=== Failed to obtain SSL certificate ==="
    echo "Make sure:"
    echo "1. Domain $DOMAIN points to this server's IP"
    echo "2. Port 80 is open in security group"
    exit 1
fi
