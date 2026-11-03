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

## Phone preview through Windows/WSL

This workspace uses the same Windows proxy as `../cal-track`: `http://192.168.1.191:3001` forwards to WSL port `3000`. The existing `Intake-Dev-Proxy-3001-LAN` firewall rule and Windows IP Helper service provide LAN access. Only one app can use this proxy at a time; stop another app on port 3000 before starting this one.

Set the computer's current LAN IPv4 in `.env` and start the development server:

```dotenv
DEV_ALLOWED_ORIGINS=192.168.1.191
```

```sh
npm run dev -- --port 3000
```

Open `http://192.168.1.191:3001` on a phone connected to the same LAN. Use the computer's current IP if it changes, and update both the Windows proxy/firewall addresses and `.env`. `DEV_ALLOWED_ORIGINS` takes hostnames/IPs without a scheme or port; restart Next.js after changing it. It must allow the browser's host even through the proxy, or HMR and dev assets can be blocked while HTML still returns 200.

If the saved proxy exists but port 3001 has no listener, refresh that entry from **Windows PowerShell as Administrator** (using the current LAN IP):

```powershell
netsh interface portproxy set v4tov4 listenaddress=192.168.1.191 listenport=3001 connectaddress=127.0.0.1 connectport=3000 protocol=tcp
```

If it still refuses connections, reload the saved mappings by restarting IP Helper from the same administrator session. This was required in this workspace:

```powershell
Restart-Service -Name iphlpsvc
```

Reuse the Windows proxy and LAN-scoped firewall rule documented in `../cal-track/AGENTS.md`; inspect them with `netsh interface portproxy show v4tov4` and `Get-NetFirewallRule -Name Intake-Dev-Proxy-3001-LAN` in Windows PowerShell. Verify both page rendering and the `/_next/hmr` WebSocket. An unauthenticated `/api/auth/session` returning 401 is expected. Use development mode for this HTTP preview: production requires HTTPS for Secure login cookies and service worker support. No migration or seeding is needed to preview the existing account. Keep port 3100 for temporary production/Playwright checks.

## Login and privacy

Sign in with the secret key. Secrets use salted scrypt hashes. Sessions use random tokens stored as SHA-256 hashes in Postgres, with HttpOnly, SameSite=Lax cookies and Secure cookies in production. Sessions last 400 days and renew after seven days of activity; browser privacy policies can shorten storage. Sign out revokes the current session. Failed logins are rate limited persistently. All data endpoints authenticate and scope personal records to the account; mutation endpoints validate JSON and request origins. Private API responses use `Cache-Control: private, no-store`.

## Persistence and caching

- **Budget:** entries, savings threshold, and the date-filter preference live in Postgres. TanStack Query loads the budget on each visit, retains it in memory while navigating, refreshes on focus/reconnect, and updates after successful writes. Budget mutations require a connection. IndexedDB is no longer used. Import/Export controls have been removed; imports are an administrative seed command.
- **Savings:** the current threshold appears in the `Threshold:` button. The sheet saves to Postgres; local storage only caches the threshold for loading. Database values take precedence. Clear removes the threshold. Existing balance color boundaries and negative-balance markers remain unchanged.
- **Currencies:** selected currencies, their array order, source, and entered amount live in Postgres and local storage. Valid local settings render immediately without a settings GET. A cache miss loads from the database. Changes save locally immediately, then sync to the server after a short debounce; writes are serialized. Unsynced changes retry after reopening, reconnecting, returning to the app, or pressing Retry. Existing local choices are uploaded once when first used after migration. Clearing local currency settings reloads the server copy. Another device reads the server copy on its first visit; an existing valid local cache remains preferred until cleared or edited.
- **Rates:** one USD-based Frankfurter table is cached in both Postgres and local storage for 24 hours. Fresh local rates avoid network reads; missing/expired rates query the authenticated server, which reuses its own fresh cache or fetches Frankfurter. Manual refresh bypasses both caches. Failed refreshes preserve usable saved rates and the original timestamp.
- **Loading:** the app shell, currency cards, budget calendar values, summary, and entries reserve space with skeletons. Controls that require budget data stay disabled until it loads; failures offer a retry.

Currency amounts retain their original precision and format with narrow-space thousand separators. Use the up/down controls to change row order. Currency calculations remain available offline after the public application shell and assets are cached. Budget data and authenticated API responses are never stored by the service worker. A local signed-in marker permits the cached converter shell offline; the server always validates authorization when connected.

The budget is the main screen. The header opens a sliding tools sidebar from the left and has the sign-out icon on the right. The sidebar has Converter and Calculator tabs along its bottom. The calculator supports arithmetic, decimals, sign toggle, CE (clear entry), C (clear all), and backspace using buttons, without a native input. Both tools retain their state while switching tabs or closing and reopening the sidebar; the current calculation resets on page reload. Every successful equals press saves its result in a scrollable history above the calculator, keeping the newest 20 in local storage, including duplicates. Tap a history result to replace the current entry while preserving a pending operation. C and CE keep the result history. Open it with the hamburger or a swipe from the left edge; close it with a left swipe, the close button, Escape, or the backdrop. Currency controls, local caching, and database synchronization work as before, and opening tools preserves the current budget view.

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
