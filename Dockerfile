# Use the official Puppeteer image (includes Chrome + all system deps)
FROM ghcr.io/puppeteer/puppeteer:21

# Puppeteer image runs as non-root user 'pptruser' — don't override
WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/server.js"]
