FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/adapters/package.json packages/adapters/package.json
COPY packages/audio/package.json packages/audio/package.json
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/storage/package.json packages/storage/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app
ENV NODE_ENV=production API_PORT=4001 DATA_DIR=/app/data EXTERNAL_CALLS_ENABLED=false
USER node
EXPOSE 4001
CMD ["pnpm","--filter","@vaani/api","start"]
