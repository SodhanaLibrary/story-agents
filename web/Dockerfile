# web/Dockerfile
# Pre-built static files - no build step needed
FROM nginx:alpine

# Create directories for SSL and certbot
RUN mkdir -p /var/www/certbot /etc/letsencrypt

COPY dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]