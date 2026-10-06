# react-native-api-base

A production-ready starter for mobile products: an **Expo (React Native) app**, an **Express REST API** and a **Next.js admin panel** in one pnpm + Turborepo monorepo. Authentication, background jobs, product analytics, user management and a full Jest test suite are already built and tested.

**What you get out of the box:**

- Registration, login, logout (one device or all), email verification, and forgot/reset password, on both API and app
- Short-lived JWT access tokens + rotating refresh tokens, Argon2id password hashing, rate limiting
- A background worker for email delivery (with retries) and scheduled cleanup of expired sessions and tokens
- Mobile app with expo-router navigation, auth-guarded screens, React Query data fetching, and SecureStore token storage
- A branded admin panel with startup analytics (DAU/WAU/MAU, retention cohorts, activation funnel, platforms, app versions) and user management (search, suspend, sign out, verify, promote, delete), with an audit log
- Unit, HTTP, and real-database integration tests; CI workflow; production Docker images

---

## Contents

- [Quick start](#quick-start)
- [Starting a new project from this template](#starting-a-new-project-from-this-template)
- [Project structure](#project-structure)
- [Commands](#commands)
- [Configuration](#configuration)
- [Running the mobile app](#running-the-mobile-app)
- [Admin panel](#admin-panel)
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
cp apps/admin/.env.example apps/admin/.env

# 4. Set a real JWT secret in apps/api/.env (the placeholder is not safe)
openssl rand -base64 64        # paste the output into JWT_ACCESS_SECRET

# 5. Create the database tables, then fill them with demo data and an admin account
pnpm db:migrate
pnpm db:seed

# 6. Run the API, job worker, admin panel and Expo dev server
pnpm dev
```

| What        | Where                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| API         | <http://localhost:4000> (check <http://localhost:4000/health/ready>)            |
| Admin panel | <http://localhost:3001>, signing in with the admin printed by `pnpm db:seed`    |
| Mobile app  | Press `i` (iOS simulator), `a` (Android emulator) or `w` (web) in the Expo pane |

> **No email account needed for development.** Without `RESEND_API_KEY`, the worker prints verification and password-reset links to its log instead of sending them. Open one in the simulator to test the deep-link screens:
>
> ```sh
> npx uri-scheme open "myapp://reset-password?token=<token-from-log>" --ios
> ```

---

## Starting a new project from this template

Rename the template **before** doing anything else. This replaces the `@repo/` package scope and the `myapp` / `My App` placeholder identity with your project's name:

```sh
git clone <this-repo-url> friendly && cd friendly
pnpm init-project friendly --dry-run    # preview every change
pnpm init-project friendly              # optional: --display-name "Friendly App"
```

| Before                                            | After                                          |
| ------------------------------------------------- | ---------------------------------------------- |
| `@repo/database`, `@repo/tsconfig`, …             | `@friendly/database`, `@friendly/tsconfig`, …  |
| `myapp://` deep links, Expo `scheme`              | `friendly://`                                  |
| JWT issuer/audience `myapp-api` / `myapp-mobile`  | `friendly-api` / `friendly-mobile`             |
| Queue prefix `myapp`                              | `friendly`                                     |
| Expo app name / slug                              | `Friendly` / `friendly`                        |
| Display name `My App` (admin panel, email sender) | `Friendly`                                     |
| Root package name, README title                   | `friendly`, `Friendly`                         |
| Docker compose project / container names          | `friendly`, `friendly-db`, `friendly-redis`, … |

The script relinks the workspace with `pnpm install` when it finishes. It refuses to run on uncommitted changes (`--force` overrides this) or on a repository that has already been renamed. Use `--skip-install` to skip the reinstall. Then [brand the admin panel](#branding) with your logo and colors.

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
      middleware/           request id, validation, auth + roles, rate limits, error handler
      modules/
        auth/               auth.{schema,service,controller,routes,tokens,mail}.ts
        admin/              admin API: analytics, user management, audit log
        activity/           records daily active users for analytics
        email/              email templates, queue and processor
        health/             /health/live and /health/ready
      jobs/                 scheduled jobs (auth-data cleanup)
      scripts/              db:seed demo data, admin:create
      test/                 Jest setup, Prisma mock, fixtures
  admin/                    Next.js admin panel (shadcn/ui + bklit UI charts)
    src/
      app/                  Routes: login, (dashboard)/{overview, users, users/[id], audit-log}
      config/               brand.ts (name, logo) and navigation.ts (sidebar)
      features/             analytics, users, audit: data fetching, server actions, components
      components/ui/        shadcn/ui components
      components/charts/    bklit UI chart components
      lib/                  API client, session cookies, auth guard, formatters
      proxy.ts              Keeps the admin session fresh; sends signed-out visitors to /login
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
| Admin    | Next.js 16 (App Router), shadcn/ui, bklit UI charts (visx), Tailwind CSS 4                       |
| Tests    | Jest, Supertest, jest-expo, React Native Testing Library, React Testing Library                  |

---

## Commands

Run from the repository root. Turborepo runs each command in every workspace that defines it.

| Command                 | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`              | API + worker, admin panel and Expo dev server (all auto-reload)                 |
| `pnpm test`             | Unit tests for API, admin and mobile (no database or Redis needed)              |
| `pnpm test:integration` | API tests against a real PostgreSQL test database (see [Testing](#testing))     |
| `pnpm check-types`      | Typecheck every workspace                                                       |
| `pnpm lint`             | Lint the admin panel and mobile app                                             |
| `pnpm build`            | Bundle the API and worker (`apps/api/dist`) and build the admin panel           |
| `pnpm db:migrate`       | Create and apply a migration in development: `pnpm db:migrate --name add_posts` |
| `pnpm db:seed`          | Replace demo data: an admin account plus ~400 users with 120 days of activity   |
| `pnpm db:deploy`        | Apply pending migrations (production release step)                              |
| `pnpm db:studio`        | Browse the database in Prisma Studio                                            |
| `pnpm db:generate`      | Regenerate the Prisma client (runs automatically before dev/test/build)         |

Run a command in a single workspace with `--filter`:

```sh
pnpm --filter api admin:create --email you@company.com   # create or promote an admin
pnpm --filter api jobs:cleanup                           # run the session/token cleanup once, now
pnpm --filter api test:watch
pnpm --filter admin dev                                  # just the admin panel
pnpm --filter mobile ios                                 # open the iOS simulator directly
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
| `CORS_ORIGINS`                            | `http://localhost:8081`  | Comma-separated browser origins (native apps and the admin panel's server don't need CORS)       |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `60000` / `100`          | Global per-IP rate limit                                                                         |
| `ACCESS_TOKEN_EXPIRES_IN`                 | `15m`                    | Access token lifetime                                                                            |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS`           | `30`                     | Refresh token / session lifetime                                                                 |
| `EMAIL_VERIFICATION_EXPIRES_IN_HOURS`     | `24`                     | Verification link lifetime                                                                       |
| `PASSWORD_RESET_EXPIRES_IN_MINUTES`       | `30`                     | Reset link lifetime                                                                              |
| `CLEANUP_CRON`                            | `0 3 * * *`              | When the cleanup job runs (cron, UTC)                                                            |
| `REVOKED_SESSION_RETENTION_DAYS`          | `7`                      | How long signed-out sessions are kept before cleanup                                             |

`packages/database/.env` only needs `DATABASE_URL`, which the Prisma CLI uses for migrations. `apps/api/.env.test` holds safe, committed values for integration tests.

### Admin panel (`apps/admin/.env`)

| Variable  | Default                        | Description                                                                                   |
| --------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `API_URL` | `http://localhost:4000/api/v1` | API base URL. Only the Next.js server calls the API; browsers never see this URL or any token |

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

## Admin panel

`apps/admin` is a Next.js app on <http://localhost:3001> for running the product: watch growth and engagement, and act on user accounts. Only accounts with the `ADMIN` role can sign in.

**First admin:** in development, `pnpm db:seed` creates one and prints its login. For a real environment, run this against that environment's database:

```sh
pnpm --filter api admin:create --email you@company.com   # prints a generated password once
```

The same command promotes an existing user. After that, admins can promote others from the panel.

### Analytics

The overview page has a 7/30/90-day range selector. All days are **UTC calendar days**. A user counts as "active" on a day if they opened the app or used it while signed in: the API records this on sign-in, token refresh and `GET /auth/me`, one row per user per day in `user_activity_days`. The admin panel's own traffic is excluded.

| Metric                   | Definition                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Total users              | Active + suspended accounts (deleted accounts excluded)                                                                                                                        |
| New signups              | Accounts created in the range, vs the previous range of the same length                                                                                                        |
| Daily active users (DAU) | Average distinct active users per day over the range                                                                                                                           |
| Weekly / monthly active  | Distinct users active in the last 7 / 30 days, vs the 7 / 30 days before                                                                                                       |
| Stickiness               | 30-day average DAU ÷ MAU: how often the typical user comes back. 20%+ is healthy for most consumer apps                                                                        |
| Email verification       | Share of users who signed up in the range and verified their email                                                                                                             |
| Signed-in devices        | Unexpired, unrevoked sessions right now                                                                                                                                        |
| Growth chart             | Daily active users and daily signups (complete days only)                                                                                                                      |
| Weekly retention         | Users grouped by signup week (Monday start); the share of each group active in week 0, 1, 2… after signup                                                                      |
| Activation funnel        | Of users who signed up in the range: verified email → came back on a later day → still active 7+ days after signup. Each step only counts users who completed the previous one |
| Platforms / app versions | Distinct active users by platform and by app version. Use it to decide when an old release can be dropped                                                                      |

The mobile app sends its platform and version on every request (`x-client-platform`, `x-app-version`); see `apps/mobile/src/api/client.ts`.

### User management

**Users** lists every account with search (name, email or ID), status and role filters, and pagination. A user's page shows their profile, a 30-day activity strip, their signed-in devices, and the admin actions taken on the account.

| Action                         | Effect                                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suspend (reason required)      | Blocks sign-in and signs the user out of every device **immediately**; existing access tokens stop working on their next request                                                                                           |
| Reactivate                     | Lifts a suspension                                                                                                                                                                                                         |
| Sign out of all devices        | Revokes every session without locking the account                                                                                                                                                                          |
| Resend / mark verified         | Re-sends the verification email, or verifies the address manually                                                                                                                                                          |
| Make admin / remove admin      | Changes the role; takes effect on the user's next request                                                                                                                                                                  |
| Delete (type email to confirm) | **Anonymizes** the account: name, email, password and device details are erased, sessions revoked. The row and anonymous activity stay, so analytics and the audit trail remain accurate, and the email can register again |

The API enforces the rules, not just the UI: admins can't suspend, demote or delete themselves, the last active admin can't be removed, and deleted accounts can't be modified. Every action is written to the **audit log** with the acting admin, in the same transaction as the change.

### How the panel works

- **Server-side only API calls.** Pages are React Server Components that call the API from the Next.js server (`src/lib/api.ts`). Changes go through server actions (`src/features/*/actions.ts`).
- **Tokens in cookies.** Access and refresh tokens are stored in **httpOnly cookies**, so browser JavaScript never sees them.
- **Session refresh.** `src/proxy.ts` refreshes the access token before it expires. It shares one refresh between parallel requests, because refresh tokens rotate.
- **Authorization.** Every page and server action calls `requireAdmin()` (`src/lib/auth.ts`), which checks the role with the API. The proxy is not an authorization layer.

### Admin API

All routes are under `/api/v1/admin` and require an active account with the `ADMIN` role (otherwise `403 FORBIDDEN`).

| Method | Path                                                        | Purpose                                                           |
| ------ | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| GET    | `/analytics/overview?days=7\|30\|90`                        | KPI values with previous-period comparisons                       |
| GET    | `/analytics/timeseries?days=`                               | Daily signups and active users                                    |
| GET    | `/analytics/retention?weeks=8`                              | Weekly signup cohorts with retention per week                     |
| GET    | `/analytics/funnel?days=`                                   | Activation funnel counts                                          |
| GET    | `/analytics/breakdown?days=`                                | Active users by platform and app version                          |
| GET    | `/users?search=&status=&role=&page=&pageSize=&sort=&order=` | Paginated user list                                               |
| GET    | `/users/:id`                                                | Profile, active sessions, last 30 days of activity, audit history |
| POST   | `/users/:id/suspend` `{ reason }`                           | Suspend and sign out everywhere                                   |
| POST   | `/users/:id/unsuspend`                                      | Reactivate                                                        |
| POST   | `/users/:id/revoke-sessions`                                | Sign out everywhere                                               |
| POST   | `/users/:id/verify-email`                                   | Mark the email verified                                           |
| POST   | `/users/:id/resend-verification`                            | Re-send the verification email                                    |
| PATCH  | `/users/:id/role` `{ role }`                                | Set `USER` or `ADMIN`                                             |
| DELETE | `/users/:id`                                                | Anonymize and soft-delete                                         |
| GET    | `/audit-log?page=&targetUserId=`                            | Admin actions, newest first                                       |

Admin error codes: `FORBIDDEN`, `CANNOT_MODIFY_SELF`, `LAST_ADMIN`, `USER_DELETED`, `ALREADY_SUSPENDED`, `NOT_SUSPENDED`, `ALREADY_VERIFIED`, `USER_INACTIVE`.

### Branding

Everything brand-specific lives in three places:

| What                         | Where                                                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name, tagline, support email | `apps/admin/src/config/brand.ts`                                                                                                                                                                                                          |
| Logo and favicon             | `apps/admin/public/brand/logo-mark.svg`: replace the file (square, SVG or PNG). Set `logo.showName: false` if your logo already contains the name                                                                                         |
| Colors                       | The **BRAND TOKENS** block at the top of `apps/admin/src/app/globals.css`: `--brand` drives buttons, active navigation, focus rings and the main chart series; `--chart-1…5` is the chart palette. Light and dark values are side by side |

`pnpm init-project` renames the name automatically; the logo and colors are yours to set. The panel supports light, dark and system themes from the user menu.

### Extending the panel

- **Add a page.** Create `apps/admin/src/app/(dashboard)/<feature>/page.tsx`, starting with `await requireAdmin()`. Then add an entry to `src/config/navigation.ts`, which renders it in the sidebar.
- **Add data.** Add an admin route in the API (`apps/api/src/modules/admin/` or your own module behind `requireAuth, requireRole('ADMIN')`). Then add fetchers in `src/features/<feature>/api.ts` that use `apiFetch()` / `apiData()`.
- **Add a dashboard widget.** Add an entry to `dashboardWidgets` in `src/features/analytics/widgets.tsx`. Widgets load their own data and stream in independently; reorder or remove entries freely.
- **Add an action.** Add a server action next to `src/features/users/actions.ts` (it re-checks the admin). Record it in the API with `recordAudit()`, and give it a readable label in `src/features/audit/describe.ts`.
- **Add a chart.** Run `pnpm dlx shadcn@latest add @bklit/<chart>` from `apps/admin`, e.g. `line-chart`, `pie-chart` or `heatmap-chart`; see <https://bklit.com/docs>. Charts read the brand colors automatically. Components from shadcn go in `src/components/ui`; bklit charts go in `src/components/charts` and are kept as published, with lint rules relaxed for that folder.

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

- **Auth:** `UNAUTHORIZED`, `INVALID_ACCESS_TOKEN`, `ACCOUNT_INACTIVE`, `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSE`, `INVALID_RESET_TOKEN`, `INVALID_VERIFICATION_TOKEN`, `USER_NOT_FOUND`, `FORBIDDEN`
- **General:** `BAD_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_SERVER_ERROR`

Every response carries an `x-request-id` header, which appears in the logs.

### How it works

- **Passwords** are hashed with Argon2id. The minimum length is 8 characters, with 12+ encouraged in the UI and no forced symbol rules. Login and forgot-password give the same answer whether or not an account exists, so attackers can't discover registered emails.
- **Access tokens** are JWTs that expire after 15 minutes and are sent on every request. On each request the API also checks that the account is still active and reads its current role. Suspending or deleting a user therefore locks them out immediately (`401 ACCOUNT_INACTIVE`), and role changes apply at once.
- **Refresh tokens** are random values. Only their SHA-256 hash is stored, one row per device in `auth_sessions`. Each refresh **rotates** the token: the old one is revoked and can't be reused, even by two simultaneous requests.
- **Reset and verification tokens** are also stored only as hashes. They expire and work once. A password reset signs the user out everywhere.
- **Rate limits** are per IP:
  - 100 requests/min globally.
  - 20 per 15 min on login, register, reset-password and verify-email.
  - 5 per 15 min on forgot-password and resend-verification.
  - 600/min on the admin API, which all comes from the admin panel's server.
  - `/me`, `/refresh` and `/logout` only count toward the global limit, because apps call them on every open.

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

User accounts and analytics activity are never touched. Running several workers is safe, because the schedule is registered only once. To run the cleanup immediately: `pnpm --filter api jobs:cleanup`.

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
| Admin panel     | `pnpm --filter admin test`  | nothing       | `apps/admin/src/**/__tests__/`                    |
| Mobile          | `pnpm --filter mobile test` | nothing       | `apps/mobile/src/**/__tests__/`                   |

**Integration tests** use a separate, throwaway database on port 5433 that is wiped before every test. They refuse to run against any database whose name doesn't contain `_test`. They cover the auth flows, the admin API (permissions, suspend/delete effects, guards) and the analytics queries.

```sh
docker compose up -d db-test
pnpm db:test:prepare        # apply migrations to the test database
pnpm test:integration
```

**API test conventions:**

- **Mocking:** the API is native ES modules. Mock a module with `jest.unstable_mockModule()`, then `await import()` the code under test; `jest.mock()` does not work here. See `src/modules/auth/__tests__/auth.service.test.ts`.
- **Prisma:** call `mockPrisma()` from `src/test/prisma-mock.ts` to replace Prisma with a deep mock in unit tests, and build test data with `src/test/fixtures.ts`.
- **HTTP:** test routes against `createApp()` with Supertest; no server or port is needed.
- **Transactions and queries:** test multi-step database logic and raw SQL (analytics) with integration tests rather than mocks. Call `flushActivity()` before asserting on activity, which is recorded asynchronously.

**Admin panel test conventions:**

- **Tooling:** Jest with `next/jest` and React Testing Library. Test client components, helpers, and `proxy.ts` (with `@jest-environment node` and a mocked `fetch`).
- **Async Server Components** aren't supported by Jest. Keep their logic in plain functions and test those, or cover pages end to end.

**Mobile test conventions:**

- **Rendering:** use `renderWithProviders()` / `renderHookWithProviders()` from `src/test/render.tsx`, which provide a fresh QueryClient and the AuthProvider.
- **Mocks:** mock `@/api/auth.api` to control server responses. SecureStore is replaced with an in-memory store; seed it with `seedTokens()`.
- **Full app:** test navigation with `renderRouter('./src/app', { initialUrl: '/login' })` from `expo-router/testing-library`. See `src/__tests__/screens/auth-flow.test.tsx`.
- **Testing Library v14:** `render`, `renderHook` and every `userEvent` call are async, so always `await` them.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, integration tests (with a Postgres service), build and `pnpm audit` on every pull request.

---

## Adding a feature

A suggested order: service → API tests → API client function → hook → screen → screen test. Add an admin page for it if operators need to see or manage it ([Extending the panel](#extending-the-panel)).

### API: `apps/api/src/modules/<feature>/`

1. **Model.** Add it to `packages/database/prisma/schema.prisma`, then run `pnpm db:migrate --name add_<feature>` and commit the generated migration.
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

   Inside a handler, `getAuthUser(req)` returns `{ id, role }`. Check that the user may access the specific resource; a valid token alone is not authorization. Use `requireRole('ADMIN')` for admin-only routes.

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

**API and worker** ship as one Docker image, and the **admin panel** as another. Both are built from the repository root:

```sh
docker build -f apps/api/Dockerfile -t myapp-api .
docker run --env-file apps/api/.env -p 4000:4000 myapp-api                       # API
docker run --env-file apps/api/.env myapp-api node dist/worker.js                # worker

docker build -f apps/admin/Dockerfile -t myapp-admin .
docker run -p 3001:3000 -e API_URL=https://api.example.com/api/v1 myapp-admin    # admin panel
```

Run at least one worker alongside the API, or emails will never be sent. The admin panel only needs to reach the API; it never talks to the database directly.

**Release order:**

1. Back up the database if the release changes the schema.
2. Run `pnpm db:deploy` once, as a release step. Never run `db:migrate` in production, and never migrate from every container on startup.
3. Roll out the API and worker containers, then the admin panel.
4. Point your platform's liveness probe at `/health/live` and its readiness probe at `/health/ready`.
5. Create the first admin with `pnpm --filter api admin:create --email …`, run with the production `DATABASE_URL`.

**Mobile:** build and submit with EAS (`npx eas-cli build`, `npx eas-cli submit`). Set `EXPO_PUBLIC_API_URL` to your production API URL in the EAS build environment.

---

## Production checklist

- [ ] `NODE_ENV=production`, with secrets in your platform's secret manager (never in the image or repo)
- [ ] Unique `JWT_ACCESS_SECRET` per environment; `RESEND_API_KEY` set and sender domain verified in Resend
- [ ] TLS terminates at a trusted load balancer; the API and admin panel are not exposed over plain HTTP (admin session cookies are `Secure` in production)
- [ ] The admin panel is reachable only from your team: VPN, IP allowlist, or an identity-aware proxy (e.g. Cloudflare Access) in front of it
- [ ] Admin accounts use strong, unique passwords; add MFA for admins before granting access to production data
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
- [ ] Your privacy policy covers the usage analytics the app records (active days, platform, app version)

---

## Troubleshooting

**The app can't reach the API ("Unable to reach the server").** `localhost` on a phone or Android emulator isn't your computer. See [Running the mobile app](#running-the-mobile-app), and restart Expo after changing `.env`.

**The API or worker exits immediately with a `ZodError`.** The environment failed validation at startup. The error's `path` names the variable that is missing or invalid; compare `apps/api/.env` with `.env.example`.

**Can't sign in to the admin panel.**

- **"Does not have admin access":** the account needs the `ADMIN` role. Use `pnpm --filter api admin:create --email …`.
- **"Unable to reach the API":** check that the API is running and `API_URL` in `apps/admin/.env` is correct.
- **"Too many authentication requests":** you hit the login rate limit (20 per 15 minutes per IP). Wait, or restart the API in development.

**The overview charts are empty.** Analytics come from real usage. Run `pnpm db:seed` for demo data in development. In other environments, check that the mobile app is pointed at this API.

**`pnpm db:migrate` hangs.** Pass the migration name without a separator: `pnpm db:migrate --name add_posts`. With `-- --name`, Prisma waits for an interactive name prompt.

**Prisma can't connect.** Check that `docker compose ps` shows `db` as healthy and that `DATABASE_URL` uses `localhost`. Inside another container, use the compose service name (`db`) instead.

**`Cannot find module './generated/prisma/client.js'`.** Run `pnpm db:generate`. The generated client is gitignored, and turbo tasks regenerate it automatically.

**Emails aren't arriving / no links in the log.** The worker must be running (`pnpm dev` starts it). Check that Redis is up (`docker compose ps`). Without `RESEND_API_KEY`, links appear in the worker's log, not your inbox.

**Port 6379 or 5432 is already in use.** Another Redis or Postgres is running locally (for example via Homebrew), and it will silently receive connections instead of the Docker one. Stop it (`brew services stop redis`) or change the port mapping in `docker-compose.yaml` and the matching URL in `.env`.

**Expo shows dependency or version warnings.** Run `npx expo install --fix`, then `npx expo-doctor` from `apps/mobile`.

**Tests hang or a worker "failed to exit gracefully".** Tests must not leave timers or connections open. Use the test QueryClient (`createTestQueryClient()`) in mobile tests, and never call `listen()` in API tests.
