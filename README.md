# Converter & Budget

A dark, mobile-first personal PWA with a currency converter and budget planner. The compact bottom navigation switches pages and remembers the last page opened. There is no branding or page header. Installation is available from a floating button at the bottom right, hidden when installed. Edit any currency amount to make it the source; all other rows update immediately. Search currencies by name or code, replace them, or add and remove rows.

The budget page combines a continuous scrollable calendar with an independently scrollable list and summary. Months connect in a single weekday grid, alternate background shades, and show the month name in each left-aligned date cell. It opens on the current local day, and its calendar runs through December 31 of the next year, advancing the horizon each year. The calendar begins in October 2026; budget-mini's original calculation baseline of September 28, 2026 is preserved for historical entries. No charts are included.

The switch between the calendar and list limits entries to those starting on or before the selected day. With it off, all entries are listed. Entries occurring on the selected day are highlighted and sorted first. The plus button opens an entry sheet for that day; tapping an entry opens the same sheet to edit it. The sheet slides in and out; swipe down on its handle or header to dismiss it, or use the close button, backdrop, or Escape. Short drags snap back, the form scrolls independently, and reduced-motion preferences skip animations. Income and expenses support one-time, daily, weekly, fortnightly, and monthly schedules, including month-end fallback. Entries can be excluded from calculations without deleting them, or deleted individually/by series. The summary shows cumulative income, expenses, and net through the selected day, plus that day's change. Each entry retains its cumulative amount, even when disabled. Calendar amounts use up to four significant digits, a comma for thousands, and a decimal point. Four-digit balances stay unshortened (`1,234`); larger amounts use four digits with K/M/B/T suffixes (`32.45K`). The selected day's summary and cell tooltips show exact amounts.

Adjustment is a third option when adding an entry. Enter the actual balance (including zero or negative balances); the app creates a one-time income or expense for the difference from the projected balance through the selected day, named `Adjustment on Oct 11, 2026`. It includes all enabled entries on that day and earlier adjustments, regardless of the list filter. The correction is fixed when added; later changes to other entries do not recalculate it. Adjustments can only be deleted, and import/export preserves that restriction. Matching balances create a zero-value adjustment.

Savings, beside Import/Export, opens a sheet for setting a positive savings threshold. It colors calendar balances and the summary Net value: below 50% is critical red, 50%–99% is muted danger red, 100%–124% is amber, 125%–149% is soft green, 150%–199% is green, and 200% or more is stronger green. The exact transitions are 50%, 100%, 125%, 150%, and 200% of the threshold. The setting persists locally across page changes and reloads. Clear (or saving an empty field) restores the usual colors. Negative balances always use the critical color, even without a threshold; their calendar cells also show a critical-colored exclamation mark at the right of the date row. Income, expense, and daily-change colors remain based on their sign.

Import and export are beside the Entries heading. Import accepts budget-mini's JSON backups or a bare array of entries, validates the entire file before saving, and merges by entry ID. Export always includes every entry, including future and disabled entries, regardless of the date filter. Budget entries are stored locally in IndexedDB and work offline.

To move existing data from budget-mini, export there and import here. Browsers isolate data by origin (scheme, host, and port), so an app served at a different address cannot read the old database. If deployed at the same origin, the existing `budget` database and `entries` store are used directly.

## Run locally

```sh
npm install
npm run dev
```

## Build and verify

```sh
npm run lint
npx playwright install chromium
npm test
npm run preview
```

`npm test` builds the production app and runs browser tests on desktop and an emulated Pixel 7. Tests cover conversion, source switching, currency selection, persistence, validation, cache expiration, API failures, budget CRUD and recurrence calculations, filtering and sorting, backup compatibility, independent scrolling at 320px, calendar year rollover, the PWA manifest, Chrome installability checks, and real service-worker-controlled offline reloads of both pages.

The PNG app icons are committed. To regenerate them, run `npm run icons` after installing Playwright's Chromium.

## Rates and saved state

- Uses [Frankfurter v2](https://frankfurter.dev/), with no API key or backend. A single USD-based rate table supplies all cross-currency conversions: `amount / sourceRate * targetRate`.
- Rates are saved in local storage for 24 hours. The app checks on launch, when returning to the app, on reconnect, and hourly while open. The refresh button bypasses that interval.
- Cached rates remain usable if the API is unavailable. The converter footer contains only rate status, a refresh button, and the date and time of the last successful refresh in the device's local time. Failed refreshes keep the previous timestamp. The rate provider's dates can differ by currency and on weekends; the displayed timestamp records when this app fetched them. These are reference rates, not bank transaction quotes.
- Currency order, source currency, and last entered amount persist in local storage. Clearing site data removes them. If storage is blocked or full, the app reports that saving failed.
- The first visit requires a connection to load rates. After a successful visit, the service worker caches the entire application, including its fonts, for offline use.
- Calculations use the unrounded source amount and cached rates; only displayed results are rounded. Amounts use narrow spaces to separate thousands (for example, `1 234 567.89`). Focusing a field removes those separators for editing, and pasting an amount with space separators also works. Amounts accept a decimal point or comma, up to 15 integer digits and 8 decimal places, with optional negatives. A comma is a decimal separator, not a thousands separator.

## Install on Android

Build with `npm run build` and serve `dist/` at the root of an **HTTPS** origin. Localhost also works for local testing; plain HTTP on a LAN address does not support PWA installation. No hosting provider is required, and no deployment is included in this repository.

Open the production site in Android Chrome, then use **Install app** or Chrome's **⋮ → Add to home screen → Install**. The manifest includes standalone mode, theme colors, 192px and 512px icons, and a maskable icon. Vite PWA generates and registers the offline service worker during production builds; development mode does not register it.

Deploy the full `dist/` directory together. Serve `sw.js` and `index.html` with revalidation (for example, `Cache-Control: no-cache`) so updates are discovered. Hashed assets can use long-lived caching. The current manifest assumes deployment at `/`; change Vite's base, the manifest paths, and service worker scope together for a subdirectory deployment.
