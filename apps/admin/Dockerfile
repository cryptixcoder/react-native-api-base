# Production image for the admin panel. Build from the repository root:
#   docker build -f apps/admin/Dockerfile -t admin:local .
#   docker run -p 3001:3000 -e API_URL=https://api.example.com/api/v1 admin:local

FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile --filter admin... \
  && pnpm --filter admin build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

# Standalone output contains only the files the server needs; static assets are copied alongside.
COPY --from=build --chown=nodeapp:nodeapp /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=nodeapp:nodeapp /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=nodeapp:nodeapp /repo/apps/admin/public ./apps/admin/public

USER nodeapp
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/login > /dev/null || exit 1
CMD ["node", "apps/admin/server.js"]
