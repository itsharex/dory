# syntax=docker/dockerfile:1.7

FROM oven/bun:1.2.22-alpine AS bun

FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable \
 && corepack prepare yarn@1.22.22 --activate

ENV CI=true

FROM base AS deps
COPY package.json yarn.lock .npmrc ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/electron/package.json ./apps/electron/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/auth-core/package.json ./packages/auth-core/package.json

RUN --mount=type=cache,target=/root/.cache/yarn \
    yarn install --frozen-lockfile --non-interactive --network-concurrency 4

FROM base AS builder
ARG VERSION
ENV VERSION="${VERSION}"

RUN apk add --no-cache bash
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=deps /app /app
COPY . .

RUN yarn run build
RUN rm -f apps/web/.next/standalone/.env apps/web/.next/standalone/.env.local

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# tzdata
RUN apk add --no-cache tzdata ca-certificates

RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs \
 && mkdir -p /app/logs /app/data \
 && chown -R nextjs:nodejs /app

USER nextjs

COPY --from=builder /app/apps/web/package.json .
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/dist-scripts ./dist-scripts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static


EXPOSE 3000
CMD ["sh", "-lc", "node dist-scripts/bootstrap.mjs && if [ -f apps/web/server.js ]; then node apps/web/server.js; else node server.js; fi"]
