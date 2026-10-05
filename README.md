# react-native-api-base

Starter monorepo for new projects: an **Express REST API** and an **Expo (React Native) app** with a complete, tested email + password authentication system.

| Layer      | Stack                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------ |
| Monorepo   | pnpm workspaces + Turborepo, Node 24                                                       |
| API        | Express 5, TypeScript, Zod, Pino, Helmet, express-rate-limit, Argon2id, JWT, Resend        |
| Database   | PostgreSQL + Prisma 7 (`packages/database`, shared as `@repo/database`)                    |
| Mobile     | Expo SDK 57, expo-router, TanStack React Query, axios, expo-secure-store                   |
| Testing    | Jest everywhere: Supertest + real-Postgres integration tests (API), jest-expo + RNTL (mobile) |

```
apps/
  api/          Express API            (src/modules/<feature>/{schema,service,controller,routes}.ts)
  mobile/       Expo app               (src/app = routes, src/api = HTTP, src/auth = session state)
packages/
  database/     Prisma schema, migrations and the shared client
  tsconfig/     Shared TS config
specs/          Design notes this starter was built from
```

## First run

```sh
nvm use 24                       # Node >= 24 is required
pnpm install
docker compose up -d db          # PostgreSQL on :5432 (db-test on :5433 is for integration tests)

cp packages/database/.env.example packages/database/.env
cp apps/api/.env.example apps/api/.env          # then set JWT_ACCESS_SECRET (openssl rand -base64 64)
cp apps/mobile/.env.example apps/mobile/.env    # use your LAN IP when testing on a physical phone

pnpm db:migrate                  # apply migrations to the dev database
pnpm dev                         # API on :4000 + Expo dev server
```

Without `RESEND_API_KEY`, the API logs verification / reset links instead of emailing them. Paste a `myapp://reset-password?token=…` link into the simulator (`npx uri-scheme open "<link>" --ios`) to exercise the deep-link screens.

## Commands

| Command                  | What it does                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- |
| `pnpm dev`               | Run the API (tsx watch) and the Expo dev server                               |
| `pnpm test`              | Unit + HTTP tests for API and mobile (no database needed)                     |
| `pnpm db:test:prepare`   | Migrate the test database (`docker compose up -d db-test` first)              |
| `pnpm test:integration`  | API integration tests against the real test database                          |
| `pnpm check-types`       | Typecheck every workspace                                                     |
| `pnpm lint`              | Lint (mobile, via `expo lint`)                                                |
| `pnpm build`             | Bundle the API to `apps/api/dist`                                             |
| `pnpm db:migrate`        | Create/apply a migration in development (`-- --name <change>`)                |
| `pnpm db:deploy`         | Apply migrations in production (run once as a release step)                   |

Per-workspace: `pnpm --filter api test:watch`, `pnpm --filter mobile test:coverage`, etc.

Production image: `docker build -f apps/api/Dockerfile -t api .` (from the repo root). CI lives in `.github/workflows/ci.yml`.

## Authentication

API (`/api/v1/auth`): `register`, `login`, `refresh`, `logout`, `logout-all`, `me`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`.

- Passwords hashed with Argon2id; generic errors prevent account enumeration.
- Short-lived JWT access tokens (15 min) + opaque refresh tokens stored as SHA-256 hashes in `auth_sessions`, **rotated on every refresh** (reuse is rejected).
- Reset and verification tokens are hashed, expiring and single-use; a password reset revokes every session.
- Errors always use `{ error: { code, message, requestId, details? } }`.

Mobile:

- Tokens live in SecureStore. `src/api/client.ts` attaches the access token, refreshes on 401 (one shared refresh for concurrent requests) and emits *session expired* when the refresh token is rejected.
- **All server calls go through React Query**: the current user is the `['auth','me']` query; login/register/logout/reset/etc. are mutation hooks in `src/auth/use-auth-mutations.ts`.
- `src/app/_layout.tsx` uses `Stack.Protected` guards to switch between the `(auth)` and `(app)` groups. `reset-password` and `verify-email` sit outside both groups so email deep links open in either state.

## Adding a feature

API (`apps/api/src/modules/<feature>/`):

1. Add models to `packages/database/prisma/schema.prisma`, then `pnpm db:migrate -- --name <feature>`.
2. `<feature>.schema.ts` (Zod), `<feature>.service.ts` (business logic, throws `AppError`), `<feature>.controller.ts`, `<feature>.routes.ts` (`validate()`, `requireAuth`, `asyncHandler`).
3. Mount the router in `src/app.ts`.
4. Tests in `__tests__/`: unit tests mock Prisma via `mockPrisma()` from `src/test/prisma-mock.ts`; `*.integration.test.ts` files hit the real test database.

> The API runs as native ESM under Jest (TypeScript 7 has no compiler API for ts-jest, so `@swc/jest` strips types). Mock modules with `jest.unstable_mockModule()` and then `await import()` the code under test; see `auth.service.test.ts`.

Mobile (`apps/mobile/src/`):

1. Request functions in `api/<feature>.api.ts` using the shared `api` client.
2. React Query hooks (`useQuery` / `useMutation`) wrapping them; never call the API directly from screens.
3. Screens in `app/`; tests in `src/__tests__/` (route files can't live next to tests in `app/`). `renderRouter('./src/app', { initialUrl })` renders the real navigation tree.

## Before production

Read the checklist in `specs/production-ready-express-rest-api.md` §17. In particular:

- Configure universal links / app links and set `MOBILE_APP_URL` to the https URL.
- Set real `CORS_ORIGINS`, and make `trust proxy` (in `apps/api/src/app.ts`) match your proxy topology.
- Use a Redis store for rate limits when running more than one API instance.
- Move email sending to a job queue with retries.
- Schedule cleanup of expired sessions and tokens (see `specs/authentication.md` §39-E).
