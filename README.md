# react-native-api-base

A production-ready starter for mobile products: an **Expo (React Native) app** and an **Express REST API** in one pnpm + Turborepo monorepo. Email + password authentication, background jobs, and a full Jest test suite are already built and tested.

**What you get out of the box:**

- Registration, login, logout (one device or all), email verification, and forgot/reset password, on both API and app
- Short-lived JWT access tokens + rotating refresh tokens, Argon2id password hashing, rate limiting
- A background worker for email delivery (with retries) and scheduled cleanup of expired sessions and tokens
- Mobile app with expo-router navigation, auth-guarded screens, React Query data fetching, and SecureStore token storage
- Unit, HTTP, and real-database integration tests; CI workflow; production Docker image

---

## Contents

- [Quick start](#quick-start)
- [Starting a new project from this template](#starting-a-new-project-from-this-template)
- [Project structure](#project-structure)
- [Commands](#commands)
- [Configuration](#configuration)
- [Running the mobile app](#running-the-mobile-app)
- [Authentication](#authentication)
- [Background jobs](#background-jobs)
- [Testing](#testing)
- [Adding a feature](#adding-a-feature)
- [Deployment](#deployment)
- [Production checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)

---

## Quick start

**Prerequisites:** Node.js **24+**, pnpm **11** (`corepack enable` sets it up), and Docker.

```sh
# 1. Install dependencies
corepack enable
pnpm install

# 2. Start PostgreSQL (:5432) and Redis (:6379)
docker compose up -d db redis

# 3. Create env files
cp packages/database/.env.example packages/database/.env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 4. Set a real JWT secret in apps/api/.env (the placeholder is not safe)
openssl rand -base64 64        # paste the output into JWT_ACCESS_SECRET

# 5. Create the database tables
pnpm db:migrate

# 6. Run the API, the job worker and the Expo dev server
pnpm dev
```

The API is now on <http://localhost:4000> (check <http://localhost:4000/health/ready>). Press `i` (iOS simulator), `a` (Android emulator) or `w` (web) in the Expo pane to open the app.

> **No email account needed for development.** Without `RESEND_API_KEY`, the worker prints verification and password-reset links to its log instead of sending them. Open one in the simulator to test the deep-link screens:
>
> ```sh
> npx uri-scheme open "myapp://reset-password?token=<token-from-log>" --ios
> ```

---

## Starting a new project from this template

Rename the template **before** doing anything else. This replaces the `@repo/` package scope and the `myapp` placeholder identity with your project's name:

```sh
git clone <this-repo-url> friendly && cd friendly
pnpm init-project friendly --dry-run    # preview every change
pnpm init-project friendly              # optional: --display-name "Friendly App"
```

| Before                                           | After                                          |
| ------------------------------------------------ | ---------------------------------------------- |
| `@repo/database`, `@repo/tsconfig`, …            | `@friendly/database`, `@friendly/tsconfig`, …  |
| `myapp://` deep links, Expo `scheme`             | `friendly://`                                  |
| JWT issuer/audience `myapp-api` / `myapp-mobile` | `friendly-api` / `friendly-mobile`             |
| Queue prefix `myapp`                             | `friendly`                                     |
| Expo app name / slug                             | `Friendly` / `friendly`                        |
| Email sender `My App <…>`                        | `Friendly <…>`                                 |
| Root package name, README title                  | `friendly`, `Friendly`                         |
| Docker compose project / container names         | `friendly`, `friendly-db`, `friendly-redis`, … |

The script relinks the workspace with `pnpm install` when it finishes. It refuses to run on uncommitted changes (`--force` overrides this) or on a repository that has already been renamed. Use `--skip-install` to skip the reinstall.

---

## Project structure

```
apps/
  api/                      Express REST API + background worker
    src/
      app.ts                Express app (middleware, routers); no port binding, so tests can use it
      server.ts             HTTP entry point (graceful shutdown)
      worker.ts             Background worker entry point (email + scheduled jobs)
      config/env.ts         Validated environment variables (the app fails fast on bad config)
      lib/                  logger (Pino), prisma, redis, resend clients
      middleware/           request id, validation, auth, rate limits, error handler
      modules/
        auth/               auth.{schema,service,controller,routes,tokens,mail}.ts
        email/              email templates, queue and processor
        health/             /health/live and /health/ready
      jobs/                 scheduled jobs (auth-data cleanup)
      test/                 Jest setup, Prisma mock, fixtures
  mobile/                   Expo app
    src/
      app/                  Routes (expo-router): every file is a screen
        (auth)/             login, register, forgot-password (signed-out only)
        (app)/              home (signed-in only)
        reset-password.tsx  Deep-link screens, open in either state
        verify-email.tsx
      api/                  axios client (token refresh), request functions, QueryClient
      auth/                 AuthProvider, React Query auth hooks, SecureStore token storage
      components/           Shared UI (Screen, TextField, Button, FormMessage, themed views)
      __tests__/            Screen and navigation tests
packages/
  database/                 Prisma schema, migrations and the shared Prisma client (@repo/database)
  tsconfig/                 Shared TypeScript configuration
scripts/init-project.mjs    Renames the template for a new project
```

| Layer    | Stack                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------ |
| Monorepo | pnpm workspaces, Turborepo                                                                       |
| API      | Node 24, Express 5, TypeScript, Zod, Pino, Helmet, express-rate-limit, Argon2id, JSON Web Tokens |
| Data     | PostgreSQL, Prisma 7                                                                             |
| Jobs     | BullMQ, Redis, Resend (email)                                                                    |
| Mobile   | Expo SDK 57, expo-router, TanStack React Query, axios, expo-secure-store                         |
| Tests    | Jest, Supertest, jest-expo, React Native Testing Library                                         |

---

## Commands

Run from the repository root. Turborepo runs each command in every workspace that defines it.

| Command                 | Description                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`              | API + worker (auto-reload) and the Expo dev server                                 |
| `pnpm test`             | Unit and HTTP tests for API and mobile (no database or Redis needed)               |
| `pnpm test:integration` | API tests against a real PostgreSQL test database (see [Testing](#testing))        |
| `pnpm check-types`      | Typecheck every workspace                                                          |
| `pnpm lint`             | Lint the mobile app                                                                |
| `pnpm build`            | Bundle the API and worker into `apps/api/dist`                                     |
| `pnpm db:migrate`       | Create and apply a migration in development: `pnpm db:migrate -- --name add_posts` |
| `pnpm db:deploy`        | Apply pending migrations (production release step)                                 |
| `pnpm db:studio`        | Browse the database in Prisma Studio                                               |
| `pnpm db:generate`      | Regenerate the Prisma client (runs automatically before dev/test/build)            |

Run a command in a single workspace with `--filter`:

```sh
pnpm --filter api test:watch
pnpm --filter api jobs:cleanup          # run the session/token cleanup once, now
pnpm --filter mobile test:coverage
pnpm --filter mobile ios                # open the iOS simulator directly
```

---

## Configuration

All configuration comes from environment variables. Each app has a committed `.env.example`; copy it to `.env`, which is gitignored. The API validates its environment at startup and refuses to start if anything is missing or invalid.

### API (`apps/api/.env`)

| Variable                                  | Default                  | Description                                                                                      |
| ----------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                            | (required)               | PostgreSQL connection string                                                                     |
| `JWT_ACCESS_SECRET`                       | (required)               | Signs access tokens. 32+ characters; generate with `openssl rand -base64 64`                     |
| `API_URL`                                 | (required)               | Public URL of the API                                                                            |
| `MOBILE_APP_URL`                          | (required)               | Base URL for links in emails: `myapp://` in development, your https universal link in production |
| `RESEND_FROM_EMAIL`                       | (required)               | Sender, e.g. `My App <noreply@example.com>`                                                      |
| `RESEND_API_KEY`                          | (none)                   | Required in production. Without it, email links are logged, not sent                             |
| `REDIS_URL`                               | `redis://localhost:6379` | Redis for the job queues                                                                         |
| `QUEUE_PREFIX`                            | `myapp`                  | Namespaces queue keys so several projects can share one Redis                                    |
| `PORT`                                    | `4000`                   | HTTP port                                                                                        |
| `NODE_ENV`                                | `development`            | `development`, `test` or `production`                                                            |
| `LOG_LEVEL`                               | `info`                   | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`                                   |
| `CORS_ORIGINS`                            | `http://localhost:8081`  | Comma-separated browser origins (native apps don't need CORS)                                    |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `60000` / `100`          | Global per-IP rate limit                                                                         |
| `ACCESS_TOKEN_EXPIRES_IN`                 | `15m`                    | Access token lifetime                                                                            |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS`           | `30`                     | Refresh token / session lifetime                                                                 |
| `EMAIL_VERIFICATION_EXPIRES_IN_HOURS`     | `24`                     | Verification link lifetime                                                                       |
| `PASSWORD_RESET_EXPIRES_IN_MINUTES`       | `30`                     | Reset link lifetime                                                                              |
| `CLEANUP_CRON`                            | `0 3 * * *`              | When the cleanup job runs (cron, UTC)                                                            |
| `REVOKED_SESSION_RETENTION_DAYS`          | `7`                      | How long signed-out sessions are kept before cleanup                                             |

`packages/database/.env` only needs `DATABASE_URL`, which the Prisma CLI uses for migrations. `apps/api/.env.test` holds safe, committed values for integration tests.

### Mobile (`apps/mobile/.env`)

| Variable              | Description                       |
| --------------------- | --------------------------------- |
| `EXPO_PUBLIC_API_URL` | API base URL, including `/api/v1` |

> Everything prefixed `EXPO_PUBLIC_` is bundled into the app and readable by anyone. Never put secrets in the mobile env.

---

## Running the mobile app

`localhost` means different things on different devices. Set `EXPO_PUBLIC_API_URL` for where the app runs, then restart Expo:

| Running on         | `EXPO_PUBLIC_API_URL`                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| iOS simulator, web | `http://localhost:4000/api/v1`                                                         |
| Android emulator   | `http://10.0.2.2:4000/api/v1`                                                          |
| Physical device    | `http://<your computer's LAN IP>:4000/api/v1`, e.g. `http://192.168.1.100:4000/api/v1` |

The app runs in **Expo Go** for day-to-day development. After adding a library with native code, build a development client (`npx expo run:ios` / `npx expo run:android`, or `eas build --profile development`). Always add mobile packages with `npx expo install <package>` so versions match the Expo SDK.

---

## Authentication

### API endpoints

All routes are under `/api/v1/auth`. Authenticated routes need `Authorization: Bearer <accessToken>`.

| Method | Path                   | Auth | Body                                     | Purpose                                                              |
| ------ | ---------------------- | :--: | ---------------------------------------- | -------------------------------------------------------------------- |
| POST   | `/register`            |      | `email, password, firstName?, lastName?` | Create an account; sends a verification email                        |
| POST   | `/login`               |      | `email, password`                        | Sign in                                                              |
| POST   | `/refresh`             |      | `refreshToken`                           | Exchange a refresh token for a new token pair                        |
| POST   | `/logout`              |      | `refreshToken`                           | Revoke this device's session                                         |
| POST   | `/logout-all`          |  ✓   |                                          | Revoke every session for the user                                    |
| GET    | `/me`                  |  ✓   |                                          | Current user                                                         |
| POST   | `/forgot-password`     |      | `email`                                  | Email a reset link (same response whether or not the account exists) |
| POST   | `/reset-password`      |      | `token, password`                        | Set a new password; signs out every device                           |
| POST   | `/verify-email`        |      | `token`                                  | Confirm the email address                                            |
| POST   | `/resend-verification` |      | `email`                                  | Send a new verification link                                         |

Health checks: `GET /health/live` (the process is up) and `GET /health/ready` (the database is reachable).

Register, login and refresh return the user and a token pair:

```sh
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"jane@example.com","password":"A-secure-password-123"}'
```

```json
{
  "message": "Login successful",
  "user": {
    "id": "…",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": null,
    "role": "USER",
    "status": "ACTIVE",
    "emailVerifiedAt": null,
    "createdAt": "…"
  },
  "accessToken": "eyJhbGciOi…",
  "refreshToken": "9f2c…"
}
```

Every error uses one shape:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "requestId": "…"
  }
}
```

Validation errors (`VALIDATION_ERROR`, 400) include `details.fieldErrors`. Other codes:

- **Auth:** `UNAUTHORIZED`, `INVALID_ACCESS_TOKEN`, `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSE`, `INVALID_RESET_TOKEN`, `INVALID_VERIFICATION_TOKEN`, `USER_NOT_FOUND`
- **General:** `BAD_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_SERVER_ERROR`

Every response carries an `x-request-id` header, which appears in the logs.

### How it works

- **Passwords** are hashed with Argon2id. The minimum length is 8 characters, with 12+ encouraged in the UI and no forced symbol rules. Login and forgot-password give the same answer whether or not an account exists, so attackers can't discover registered emails.
- **Access tokens** are JWTs that expire after 15 minutes and are sent on every request.
- **Refresh tokens** are random values. Only their SHA-256 hash is stored, one row per device in `auth_sessions`. Each refresh **rotates** the token: the old one is revoked and can't be reused, even by two simultaneous requests.
- **Reset and verification tokens** are also stored only as hashes. They expire and work once. A password reset signs the user out everywhere.
- **Rate limits:** 100 requests/min per IP globally, 20 per 15 min on auth routes, and 5 per 15 min on forgot-password and resend-verification.

### In the mobile app

- **Token storage:** tokens live in **SecureStore** (iOS Keychain / Android Keystore), never AsyncStorage.
- **Automatic refresh:** `src/api/client.ts` attaches the access token to every request. On a 401 it refreshes once, sharing a single refresh across simultaneous requests, then retries. If the server rejects the refresh token, it clears the tokens and signs the user out. A network failure does **not** sign the user out.
- **Server calls:** all of them go through **React Query**. The signed-in user is the `['auth', 'me']` query, and actions are mutation hooks in `src/auth/use-auth-mutations.ts` (`useLogin`, `useRegister`, `useLogout`, `useLogoutAllDevices`, `useForgotPassword`, `useResetPassword`, `useVerifyEmail`, `useResendVerification`).

  ```tsx
  const login = useLogin();
  login.mutate({ email, password }); // login.isPending, login.error
  const { user, isAuthenticated } = useAuth();
  ```

- **Navigation:** `src/app/_layout.tsx` uses `Stack.Protected` guards. Signing in or out switches between the `(auth)` and `(app)` screen groups automatically, with no manual redirects.
- **Deep links:** `myapp://reset-password?token=…` and `myapp://verify-email?token=…` open their screens whether or not the user is signed in.

---

## Background jobs

The worker (`apps/api/src/worker.ts`) runs as its own process, separate from the API. Slow email providers and long jobs never delay API responses, and the worker can be scaled independently. The API and worker share Redis.

**Email delivery.** The API never sends email itself: `sendVerificationEmail` and `sendPasswordResetEmail` in `auth.mail.ts` add a job to the `email` queue and return immediately. The worker renders the template (`src/modules/email/email.templates.ts`) and sends it through Resend.

- A failed send is retried 5 times with exponential backoff.
- Delivered jobs are deleted from Redis at once because they contain single-use tokens.
- If Redis is unavailable, the API request still succeeds and the error is logged; the user can request a new link.

**Cleanup.** Once a day (`CLEANUP_CRON`, default 03:00 UTC) the worker deletes:

- expired sessions
- sessions revoked more than 7 days ago
- expired or used reset and verification tokens

User accounts are never touched. Running several workers is safe, because the schedule is registered only once. To run the cleanup immediately: `pnpm --filter api jobs:cleanup`.

**Adding a job:**

1. Create a queue module next to `email.queue.ts`, using `queueOptions()` from `src/lib/redis.ts`.
2. Write the processor as a plain async function so it can be unit tested.
3. Register a `Worker` for it in `src/worker.ts`.
4. For recurring work, add a scheduler like `scheduleAuthCleanup()` in `src/jobs/maintenance.queue.ts`.

---

## Testing

| Suite           | Command                     | Needs         | Location                                          |
| --------------- | --------------------------- | ------------- | ------------------------------------------------- |
| API unit + HTTP | `pnpm --filter api test`    | nothing       | `apps/api/src/**/__tests__/*.test.ts`             |
| API integration | `pnpm test:integration`     | test database | `apps/api/src/**/__tests__/*.integration.test.ts` |
| Mobile          | `pnpm --filter mobile test` | nothing       | `apps/mobile/src/**/__tests__/`                   |

**Integration tests** use a separate, throwaway database on port 5433 that is wiped before every test. They refuse to run against any database whose name doesn't contain `_test`.

```sh
docker compose up -d db-test
pnpm db:test:prepare        # apply migrations to the test database
pnpm test:integration
```

**API test conventions:**

- **Mocking:** the API is native ES modules. Mock a module with `jest.unstable_mockModule()`, then `await import()` the code under test; `jest.mock()` does not work here. See `src/modules/auth/__tests__/auth.service.test.ts`.
- **Prisma:** call `mockPrisma()` from `src/test/prisma-mock.ts` to replace Prisma with a deep mock in unit tests, and build test data with `src/test/fixtures.ts`.
- **HTTP:** test routes against `createApp()` with Supertest; no server or port is needed.
- **Transactions and queries:** test multi-step database logic with integration tests rather than mocks.

**Mobile test conventions:**

- **Rendering:** use `renderWithProviders()` / `renderHookWithProviders()` from `src/test/render.tsx`, which provide a fresh QueryClient and the AuthProvider.
- **Mocks:** mock `@/api/auth.api` to control server responses. SecureStore is replaced with an in-memory store; seed it with `seedTokens()`.
- **Full app:** test navigation with `renderRouter('./src/app', { initialUrl: '/login' })` from `expo-router/testing-library`. See `src/__tests__/screens/auth-flow.test.tsx`.
- **Testing Library v14:** `render`, `renderHook` and every `userEvent` call are async, so always `await` them.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, integration tests (with a Postgres service), build and `pnpm audit` on every pull request.

---

## Adding a feature

A suggested order: service → API tests → API client function → hook → screen → screen test.

### API: `apps/api/src/modules/<feature>/`

1. **Model.** Add it to `packages/database/prisma/schema.prisma`, then run `pnpm db:migrate -- --name add_<feature>` and commit the generated migration.
2. **Schema.** `<feature>.schema.ts` holds the Zod schemas for request bodies, params and queries.
3. **Service.** `<feature>.service.ts` holds the business logic. Import `prisma` from `@/lib/prisma.js`, and throw `new AppError(status, 'CODE', 'message')` for expected failures.
4. **Controller and routes.** In `<feature>.controller.ts` and `<feature>.routes.ts`:

   ```ts
   router.post(
     "/",
     requireAuth,
     validate({ body: createPostSchema }),
     asyncHandler(controller.create),
   );
   ```

   Inside a handler, `getAuthUser(req)` returns `{ id, role }`. Check that the user may access the specific resource; a valid token alone is not authorization.

5. **Mount.** Mount the router in `src/app.ts`: `app.use('/api/v1/posts', postRouter)`.
6. **Tests.** Cover success, validation failure, missing resource and unauthorized access.

Imports use the `@/…` alias (→ `src/`) and keep the `.js` extension on TypeScript files, e.g. `import { prisma } from '@/lib/prisma.js'`.

### Mobile: `apps/mobile/src/`

1. **Request functions.** Put them in `api/<feature>.api.ts` and use the shared `api` client, which handles tokens and refresh.
2. **React Query hooks.** Wrap them in hooks (`useQuery` for reads, `useMutation` for writes). Screens never call the API directly.
3. **Screens.** Add them under `app/`. Every file there is a route, so keep components, hooks and tests elsewhere. Wrap a screen in a `(app)/…` folder to require sign-in.
4. **Tests.** Put them in `src/__tests__/` or next to the hook or component.

---

## Deployment

**API and worker** ship as one Docker image, built from the repository root:

```sh
docker build -f apps/api/Dockerfile -t myapp-api .
docker run --env-file apps/api/.env -p 4000:4000 myapp-api                 # API
docker run --env-file apps/api/.env myapp-api node dist/worker.js          # worker
```

Run at least one worker alongside the API, or emails will never be sent.

**Release order:**

1. Back up the database if the release changes the schema.
2. Run `pnpm db:deploy` once, as a release step. Never run `db:migrate` in production, and never migrate from every container on startup.
3. Roll out the API and worker containers.
4. Point your platform's liveness probe at `/health/live` and its readiness probe at `/health/ready`.

**Mobile:** build and submit with EAS (`npx eas-cli build`, `npx eas-cli submit`). Set `EXPO_PUBLIC_API_URL` to your production API URL in the EAS build environment.

---

## Production checklist

- [ ] `NODE_ENV=production`, with secrets in your platform's secret manager (never in the image or repo)
- [ ] Unique `JWT_ACCESS_SECRET` per environment; `RESEND_API_KEY` set and sender domain verified in Resend
- [ ] TLS terminates at a trusted load balancer; the API is not exposed over plain HTTP
- [ ] `trust proxy` in `apps/api/src/app.ts` matches your real proxy count (wrong values break rate limiting and allow IP spoofing)
- [ ] `CORS_ORIGINS` lists only your real web origins
- [ ] Universal Links (iOS) / App Links (Android) configured, and `MOBILE_APP_URL` set to that https URL so email links open the app
- [ ] Rate limits use a shared Redis store when running more than one API instance (the default store is per-process)
- [ ] Redis persistence (AOF) enabled so queued emails survive a restart
- [ ] Database uses a least-privilege user, with backups and a tested restore
- [ ] Migrations run once per release via `pnpm db:deploy`
- [ ] Logs collected centrally (they're JSON in production; tokens, passwords and auth headers are redacted)
- [ ] Error tracking and alerting set up, plus dependency and vulnerability alerts
- [ ] Every endpoint checks the user may access the specific resource, not just that they're signed in

---

## Troubleshooting

**The app can't reach the API ("Unable to reach the server").** `localhost` on a phone or Android emulator isn't your computer. See [Running the mobile app](#running-the-mobile-app), and restart Expo after changing `.env`.

**The API or worker exits immediately with a `ZodError`.** The environment failed validation at startup. The error's `path` names the variable that is missing or invalid; compare `apps/api/.env` with `.env.example`.

**Prisma can't connect.** Check that `docker compose ps` shows `db` as healthy and that `DATABASE_URL` uses `localhost`. Inside another container, use the compose service name (`db`) instead.

**`Cannot find module './generated/prisma/client.js'`.** Run `pnpm db:generate`. The generated client is gitignored, and turbo tasks regenerate it automatically.

**Emails aren't arriving / no links in the log.** The worker must be running (`pnpm dev` starts it). Check that Redis is up (`docker compose ps`). Without `RESEND_API_KEY`, links appear in the worker's log, not your inbox.

**Port 6379 or 5432 is already in use.** Another Redis or Postgres is running locally (for example via Homebrew), and it will silently receive connections instead of the Docker one. Stop it (`brew services stop redis`) or change the port mapping in `docker-compose.yaml` and the matching URL in `.env`.

**Expo shows dependency or version warnings.** Run `npx expo install --fix`, then `npx expo-doctor` from `apps/mobile`.

**Tests hang or a worker "failed to exit gracefully".** Tests must not leave timers or connections open. Use the test QueryClient (`createTestQueryClient()`) in mobile tests, and never call `listen()` in API tests.
