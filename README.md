# Converter & Budget

A mobile-first personal currency converter and budget planner built with Next.js App Router, React, TanStack Query, Drizzle ORM, and Neon Postgres. Existing calendar, recurrence, adjustment, and conversion calculations are preserved.

## Setup

Use Node.js 24 or newer and npm. Copy `.env.example` to `.env` and set `NEON_PG_DB_URL` to your Postgres connection string. Credentials, secret files, and personal budget dumps are gitignored.

```sh
npm install
npm run db:migrate
npm run db:seed -- --cal-track-env ../cal-track/.env --budget-file budget-entries-2026-11-03.json
npm run dev
```

The account uses the same secret key as `../cal-track` by copying its live account's password hash with `--cal-track-env`. Its plaintext key file may be stale. For a different installation, provide `APP_LOGIN_SECRET` while seeding or pass another `--secret-file`. Seeding preserves existing accounts and never changes their secret. The optional `--budget-file` accepts a versioned dump or an array, validates every entry before writing, preserves IDs, schedules, disabled flags, adjustments, and timestamps, and skips existing IDs. It is safe to rerun. The supplied 24-entry dump has already been imported into the configured database.

`npm run dev` listens on `0.0.0.0:3000`. Set comma-separated `DEV_ALLOWED_ORIGINS` when previewing through another hostname or a LAN proxy. For production use HTTPS:

```sh
npm run build
npm run start
```

## Login and privacy

Sign in with the secret key. Secrets use salted scrypt hashes. Sessions use random tokens stored as SHA-256 hashes in Postgres, with HttpOnly, SameSite=Lax cookies and Secure cookies in production. Sessions last 400 days and renew after seven days of activity; browser privacy policies can shorten storage. Sign out revokes the current session. Failed logins are rate limited persistently. All data endpoints authenticate and scope personal records to the account; mutation endpoints validate JSON and request origins. Private API responses use `Cache-Control: private, no-store`.

## Persistence and caching

- **Budget:** entries, savings threshold, and the date-filter preference live in Postgres. TanStack Query loads the budget on each visit, retains it in memory while navigating, refreshes on focus/reconnect, and updates after successful writes. Budget mutations require a connection. IndexedDB is no longer used. Import/Export controls have been removed; imports are an administrative seed command.
- **Savings:** the current threshold appears in the `Threshold:` button. The sheet saves to Postgres; local storage only caches the threshold for loading. Database values take precedence. Clear removes the threshold. Existing balance color boundaries and negative-balance markers remain unchanged.
- **Currencies:** selected currencies, their array order, source, and entered amount live in Postgres and local storage. Valid local settings render immediately without a settings GET. A cache miss loads from the database. Changes save locally immediately, then sync to the server after a short debounce; writes are serialized. Unsynced changes retry after reopening, reconnecting, returning to the app, or pressing Retry. Existing local choices are uploaded once when first used after migration. Clearing local currency settings reloads the server copy. Another device reads the server copy on its first visit; an existing valid local cache remains preferred until cleared or edited.
- **Rates:** one USD-based Frankfurter table is cached in both Postgres and local storage for 24 hours. Fresh local rates avoid network reads; missing/expired rates query the authenticated server, which reuses its own fresh cache or fetches Frankfurter. Manual refresh bypasses both caches. Failed refreshes preserve usable saved rates and the original timestamp.
- **Loading:** the app shell, currency cards, budget calendar values, summary, and entries reserve space with skeletons. Controls that require budget data stay disabled until it loads; failures offer a retry.

Currency amounts retain their original precision and format with narrow-space thousand separators. Use the up/down controls to change row order. Currency calculations remain available offline after the public application shell and assets are cached. Budget data and authenticated API responses are never stored by the service worker. A local signed-in marker permits the cached converter shell offline; the server always validates authorization when connected.

## Database migrations

Tables use the `pocket_` prefix, with a separate `pocket_migrations` journal, to avoid touching unrelated application tables. Foreign keys scope records to accounts. Generate a new migration after schema changes, then apply it:

```sh
npm run db:generate
npm run db:migrate
```

Each migration and its journal entry run in one Neon transaction. Applied migrations are retained and skipped on later runs. Do not use schema push against a shared database.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright starts the production server on port 3100 and checks desktop and Pixel 7 layouts. UI regression tests use mocked API state. Server integration tests use temporary accounts and delete only their own data; the secret-key test signs in and out of the personal account without changing its budget or settings. Integration tests require the configured database. For the login test, supply the current key through `APP_LOGIN_SECRET`; the sibling key file is used only if it matches the live hash. Credential-bearing traces are disabled. Set `NO_PROXY=127.0.0.1,localhost` if your environment proxies loopback requests.

## Installation

The Next.js manifest includes standalone mode, theme colors, 192px and 512px icons, and a maskable icon. A production service worker caches the public shell and static assets, never private API data. Install from the floating button or your browser menu on an HTTPS origin. PNG icons are tracked; regenerate with `npm run icons`.
