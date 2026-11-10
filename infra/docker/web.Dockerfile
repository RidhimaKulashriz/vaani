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
RUN pnpm --filter @vaani/web build
ENV NODE_ENV=production PORT=3000 API_ORIGIN=http://api:4001
EXPOSE 3000
CMD ["pnpm","--filter","@vaani/web","start"]
