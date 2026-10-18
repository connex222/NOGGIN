# Multi-platform image: linux/amd64 and linux/arm64 (including Oracle Ampere A1).
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./server/
# Only the compressed runtime avatars in public/ are shipped to the container.
# source-art/ is excluded by .dockerignore and is deliberately never copied.
COPY public/ ./public/
COPY data/ ./data/
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
