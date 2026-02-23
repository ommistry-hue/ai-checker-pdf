FROM node:20-slim

# Chromium and its runtime dependencies on Debian Bookworm
RUN apt-get update && apt-get install -y \
  chromium \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip downloading its own Chrome and use the system one
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/server.js"]
