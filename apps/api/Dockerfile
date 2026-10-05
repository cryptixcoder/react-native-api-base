# Production image for the API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t api:local .
#
# The same image runs both processes:
#   API:    docker run api:local                        (default CMD)
#   Worker: docker run api:local node dist/worker.js    (email delivery + scheduled cleanup; needs REDIS_URL)
#
# Run database migrations as a separate release step (pnpm db:deploy) before rolling out new containers.

FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile --filter api... \
  && pnpm --filter @repo/database db:generate \
  && pnpm --filter api build \
  && pnpm --filter api deploy --prod --legacy /out \
  && rm -rf /out/dist && cp -r apps/api/dist /out/dist

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

COPY --from=build --chown=nodeapp:nodeapp /out/package.json ./package.json
COPY --from=build --chown=nodeapp:nodeapp /out/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodeapp /out/dist ./dist

USER nodeapp
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health/live || exit 1
CMD ["node", "--enable-source-maps", "dist/server.js"]
