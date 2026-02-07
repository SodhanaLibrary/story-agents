# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/
COPY server/ ./server/
COPY database/ ./database/

# Create storage directories
RUN mkdir -p storage/avatars storage/pages

EXPOSE 3001

CMD ["npm", "run", "server"]