# Pocket — Currency Converter

A small, dark, mobile-first React app for converting between one to five currencies. Edit any amount to make it the source; all other rows update immediately. Search currencies by name or code, replace them, or add and remove rows.

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

`npm test` builds the production app and runs browser tests on desktop and an emulated Pixel 7. Tests cover cross-currency conversion, source switching, currency selection, persistence, validation, cache expiration, API failures, the PWA manifest, Chrome installability checks, and a real service-worker-controlled offline reload.

The PNG app icons are committed. To regenerate them, run `npm run icons` after installing Playwright's Chromium.

## Rates and saved state

- Uses [Frankfurter v2](https://frankfurter.dev/), with no API key or backend. A single USD-based rate table supplies all cross-currency conversions: `amount / sourceRate * targetRate`.
- Rates are saved in local storage for 24 hours. The app checks on launch, when returning to the app, on reconnect, and hourly while open. The refresh button bypasses that interval.
- Cached rates remain usable if the API is unavailable. The app shows offline/error status and the actual date range of the selected rates, which can differ by currency and on weekends. These are reference rates, not bank transaction quotes.
- Currency order, source currency, and last entered amount persist in local storage. Clearing site data removes them. If storage is blocked or full, the app reports that saving failed.
- The first visit requires a connection to load rates. After a successful visit, the service worker caches the entire application, including its fonts, for offline use.
- Calculations use the unrounded source amount and cached rates; only displayed results are rounded. Amounts accept a decimal point or comma, up to 15 integer digits and 8 decimal places, with optional negatives. A comma is a decimal separator, not a thousands separator.

## Install on Android

Build with `npm run build` and serve `dist/` at the root of an **HTTPS** origin. Localhost also works for local testing; plain HTTP on a LAN address does not support PWA installation. No hosting provider is required, and no deployment is included in this repository.

Open the production site in Android Chrome, then use **Install app** or Chrome's **⋮ → Add to home screen → Install**. The manifest includes standalone mode, theme colors, 192px and 512px icons, and a maskable icon. Vite PWA generates and registers the offline service worker during production builds; development mode does not register it.

Deploy the full `dist/` directory together. Serve `sw.js` and `index.html` with revalidation (for example, `Cache-Control: no-cache`) so updates are discovered. Hashed assets can use long-lived caching. The current manifest assumes deployment at `/`; change Vite's base, the manifest paths, and service worker scope together for a subdirectory deployment.
