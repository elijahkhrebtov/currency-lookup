# Project guidance

## Product and stack

Converter & Budget is a personal, mobile-first, dark PWA. Read `README.md` for setup and persistence behavior. Preserve its compact layout, conversion precision, calendar calculations, and existing personal data.

Use Next.js App Router, React, npm, TanStack Query, Drizzle ORM, and Neon Postgres. Keep `package-lock.json` synchronized with dependencies. Use Node.js 24 or newer.

- `src/app/`: public page shell, metadata, manifest, loading UI, and authenticated API routes.
- `src/App.jsx`: budget-first shell, header, sign out, and PWA installation.
- `src/components/Sidebar.jsx`: animated tools drawer, swipe gestures, accessible tabs, and focus handling.
- `src/components/Converter.jsx`, `src/currency.js`, and the currency hooks: converter UI, calculations, local caching, and server synchronization.
- `src/components/Calculator.jsx` and `src/calculator.js`: button-only calculator UI and pure calculation state transitions.
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

The budget is the main screen; do not restore the old page tabs or persisted page selection. A separate header has a hamburger on the left and an accessible sign-out icon on the right. Center the month/year relative to the full calendar width using balanced side columns; Today sits on the left and month arrows on the right. Keep long month names and controls from overlapping at 320px.

The hamburger opens a sliding tools sidebar with two bottom tabs, Converter and Calculator. Use `@use-gesture/react` for left-edge swipe opening and swipe-left closing. Preserve vertical scrolling, input editing, nested currency picker dialogs, focus trapping/restoration, Escape/backdrop dismissal, and reduced motion. Escape in a nested picker must close only that picker. Keep bottom tab padding at a compact 4px, without adding bottom safe-area padding there.

Keep the budget and both tools mounted when switching tabs or closing the sidebar, preserving the selected calendar date, converter values, calculator entry, pending operation, and selected tab. Inactive tab panels must be hidden and excluded from keyboard focus. Preserve accessible tab selection, arrow-key navigation, and focus wrapping through visible controls. Currency loading or failures must not block the budget or calculator.

Calculator uses buttons and a text output, with no native input or editable field. Preserve arithmetic, decimals, sign toggle, CE (current entry), C (whole calculation), backspace, repeated equals, and recovery from division by zero or overflow. Operations chain left to right, like a basic calculator; display results at 15 significant digits to avoid floating-point tails. Keep calculator logic pure and do not evaluate expression strings. The current entry, pending operation, and selected tab last for the current app session and reset on reload. Recent results are the exception: each successful equals press, including repeated equals and standalone values, prepends a result to `pocket-calculator.results.v1` in local storage. Keep the newest 20, including duplicates; never save error states or intermediate results from operator presses. Validate cached history and handle unavailable storage without breaking calculations. Tapping a result replaces the current entry, preserves any pending operation, and clears repeated-equals state. C and CE do not erase history. Keep history independently scrollable above the screen and keypad, with controls stationary on normal phone sizes. Do not add a visible history heading or count. Use square rows with straight separators inset 8px to align with the text, and omit the separator after the last item. Do not add database persistence for calculator history.

The savings control reads `Threshold:` followed by the current number or `Not set`. Both label and number open the same savings form. Preserve keyboard focus, accessible names, mobile safe areas, independently scrolling calendar/list areas, and bottom-sheet drag/dismiss behavior.

Reserve space with skeletons for loading currency cards, calendar values, summary, and entries. Do not show zero balances or an empty budget as if data had loaded. Disable actions that require data until it arrives; retain existing data during background refreshes and offer retry on failures.

`npm run build` generates the ignored `public/sw.js` from `scripts/service-worker.js` and the current Next.js build assets. Keep this generation step: precaching all public chunks is required for reliable offline converter reloads. Register the worker only in production. Never cache private API responses, budget data, or authenticated page payloads. The root shell must remain public and contain no personal data.

## Phone preview through Windows/WSL

Use the working proxy setup documented in `../cal-track/AGENTS.md`. The verified computer LAN IP is `192.168.1.191` on `192.168.1.0/24`; confirm the current IP before reusing it. The Windows proxy listens on `192.168.1.191:3001` and forwards to WSL `127.0.0.1:3000`. Reuse the existing `Intake-Dev-Proxy-3001-LAN` firewall rule and running `iphlpsvc` service; keep any firewall exception limited to the port and LAN subnet.

The local `.env` sets `DEV_ALLOWED_ORIGINS=192.168.1.191`. Start this repo with `npm run dev -- --port 3000`, listening on `0.0.0.0`, and open `http://192.168.1.191:3001` on the phone. Only one app can own port 3000: inspect listeners and their working directory before replacing any process. Reserve 3100 for temporary production/Playwright checks and leave the requested phone dev server running.

`next.config.ts` reads comma-separated `DEV_ALLOWED_ORIGINS`, using hostnames/IPs only, without a scheme or port. Restart Next after changing it. The browser's host must be allowed even through the proxy: blocked dev assets or `/_next/hmr` can cause endless loading despite HTML returning 200. Verify page rendering and HMR through the proxy. A session GET returning 401 before login is expected. Use dev mode for HTTP LAN preview; production requires HTTPS for Secure session cookies and service workers. Do not migrate, seed, or change personal data just to preview the app.

A saved proxy entry can exist without an active listener even while `iphlpsvc` is running. First check direct Windows access to port 3000, then inspect `Get-NetTCPConnection -LocalPort 3001 -State Listen`. Refresh the existing mapping with `netsh interface portproxy set v4tov4 listenaddress=192.168.1.191 listenport=3001 connectaddress=127.0.0.1 connectport=3000 protocol=tcp` from **Windows PowerShell as Administrator**. If refreshing the entry does not restore connections, run `Restart-Service -Name iphlpsvc` in the administrator session to reload the saved mappings; this restored the proxy in this workspace. Codex tool escalation alone does not confer Windows administrator rights; Windows UAC elevation may still be required.

Inspect Windows settings with PowerShell/netsh as described in the sibling repo. `UtilBindVsockAnyPort: socket failed` from the sandbox means Windows interop is blocked; retry through tool escalation. If the computer's IP changes, update the `.env` origin and Windows proxy/firewall addresses together.

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

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
