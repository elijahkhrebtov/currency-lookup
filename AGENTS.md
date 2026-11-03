# Project guidance

## Product and stack

Converter & Budget is a personal, mobile-first, dark PWA. Read `README.md` for setup and persistence behavior. Preserve its compact layout, conversion precision, calendar calculations, and existing personal data.

Use Next.js App Router, React, npm, TanStack Query, Drizzle ORM, and Neon Postgres. Keep `package-lock.json` synchronized with dependencies. Use Node.js 24 or newer.

- `src/app/`: public page shell, metadata, manifest, loading UI, and authenticated API routes.
- `src/App.jsx`, `src/currency.js`, and the currency hooks: converter UI, calculations, local caching, and server synchronization.
- `src/budget/`: budget UI, sheets, calendar, and pure financial calculations.
- `src/lib/`: validation, HTTP/authentication helpers, repository, and database schema/connection.
- `src/components/Icon.jsx`: shared icons without hooks; safe in Server and Client Components.
- `src/ui.jsx`: client-only modal code and icon re-export. Server-rendered skeletons must import icons directly from `components/Icon`, not this client module.
- `drizzle/` and `scripts/`: versioned migrations, account/data initialization, icon generation, and service worker build generation.

## Authentication and secrets

The personal account uses the same secret as the **live account** in `../cal-track`. Initialize a new account with `npm run db:seed -- --cal-track-env ../cal-track/.env`; this copies the live scrypt hash without copying plaintext credentials. The sibling `app-login-secret` file can be stale and must not be treated as the current account key. For independent installations, use `APP_LOGIN_SECRET` or `--secret-file` instead.

Seeding must preserve existing accounts and secrets. Do not silently rotate a secret on ordinary startup or seed runs. An explicitly requested credential repair may synchronize the hash with the live source account.

Never print or commit `.env`, login keys, password hashes, session tokens, database URLs, or personal budget dumps. `.env.example` contains placeholders only. Avoid credential-bearing browser traces and request-body logs.

Preserve scrypt password verification, hashed random session tokens, persistent login rate limiting, logout revocation, HttpOnly cookies, SameSite=Lax protection, and Secure cookies in production. Sessions last 400 days and renew after seven days of activity. All private data endpoints must authenticate and scope queries to the account. Validate mutations and origins with the existing helpers; private responses remain `private, no-store`.

When signing out or handling an expired session, use `clearPrivateData()`. Keep the active session query observable while changing it to the signed-out state; clearing the entire query client can leave the dashboard visible.

## Persistence and database changes

Use the configured `NEON_PG_DB_URL`. All application tables use the `pocket_` prefix and migrations use the separate `pocket_migrations` journal. Do not modify unrelated tables or the sibling application's data.

After schema changes, generate a new migration with `npm run db:generate` and apply it with `npm run db:migrate`. Preserve applied migrations and metadata. Each migration and journal entry must remain atomic. Do not use schema push against the shared database.

Budget imports are an administrative seed operation using `--budget-file`. Validate the entire dump before writing, retain IDs, timestamps, disabled flags, recurrence, and adjustment metadata, and skip existing IDs. Imports must remain repeatable without overwriting saved entries. Keep import/export controls out of the app.

## Data and calculation rules

- Budget entries, savings threshold, and the through-date filter are authoritative in Postgres. Load through TanStack Query and save mutations to the server. Do not restore budget entries from IndexedDB or local storage.
- Cache the savings threshold locally only for loading. Server values take precedence. A legacy local threshold may initialize missing database settings once; it must never overwrite an existing server value.
- Currency selection, array order, source, and entered amount live in Postgres and local storage. Prefer valid local settings without a settings GET; fetch when absent or invalid. Persist edits locally immediately, debounce and serialize writes, and retain/retry unsynced changes after reopening, reconnecting, or returning to the app.
- Cache USD-based Frankfurter rates in Postgres and local storage for 24 hours. Fresh local rates avoid reads. Missing or expired local rates use the authenticated server cache/provider. Manual refresh bypasses caches; failures retain usable rates and their original timestamp.
- Preserve unrounded source amounts and cent precision. Formatting must not alter saved amounts. Currency inputs support decimal commas, partial decimals, negatives, and narrow-space thousands separators.
- Preserve the budget baseline, advancing calendar horizon, local tracking dates, month-end and leap-day recurrence behavior, inclusive date filtering, and cumulative totals for disabled entries. Disabled entries do not affect balances.
- Adjustments are fixed one-time balance corrections, including zero-value corrections. They cannot be edited or disabled, only deleted. Preserve server-side validation of these restrictions.
- Preserve the savings color boundaries at 50%, 100%, 125%, 150%, and 200%, and always mark negative balances as critical.

## Interface and PWA

Keep compact bottom navigation for Converter and Budget. Sign out is an accessible icon button at the far left of the converter heading and calendar controls, not in bottom navigation. Center the month/year relative to the full calendar width using balanced side columns; Today sits beside sign out and month arrows sit on the right. Keep long month names and controls from overlapping at 320px.

The savings control reads `Threshold:` followed by the current number or `Not set`. Both label and number open the same savings form. Preserve keyboard focus, accessible names, mobile safe areas, independently scrolling calendar/list areas, and bottom-sheet drag/dismiss behavior.

Reserve space with skeletons for loading currency cards, calendar values, summary, and entries. Do not show zero balances or an empty budget as if data had loaded. Disable actions that require data until it arrives; retain existing data during background refreshes and offer retry on failures.

`npm run build` generates the ignored `public/sw.js` from `scripts/service-worker.js` and the current Next.js build assets. Keep this generation step: precaching all public chunks is required for reliable offline converter reloads. Register the worker only in production. Never cache private API responses, budget data, or authenticated page payloads. The root shell must remain public and contain no personal data.

## Validation and commits

Run checks appropriate to the change:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Production builds are required when changing imports shared between Server and Client Components; lint/type checks alone do not detect every Next.js boundary violation. Review responsive screenshots for layout changes and verify narrow phones without adding tests that merely repeat CSS declarations.

Playwright starts a production server on port 3100. Preserve any existing phone/dev server on port 3000 and stop temporary servers you start. UI tests mock API state; database integration tests use temporary accounts and delete only their own records. For the live login test, supply the current key through `APP_LOGIN_SECRET`; a stale local key file is not valid evidence. The optional original-dump comparison is only appropriate while the personal account still matches that dump.

Before a requested commit, review the staged diff, confirm credentials, personal dumps, generated service workers, `.next`, and test artifacts are excluded, and run `git diff --check`. Preserve unrelated user edits. Report the commit, push result, and meaningful validation or limitations.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
