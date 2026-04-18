# Architecture & decisions

This document describes how the **Countdown Timer** Shopify app is structured and the main tradeoffs behind those choices.

## High-level shape

- **Embedded admin app** (`embedded = true`): merchants use the UI inside Shopify Admin. The backend serves OAuth, JSON APIs, and the built SPA (`web/frontend/dist`).
- **Monorepo workspaces** (`package.json`): root CLI scripts; `web` (Node server); `web/frontend` (Vite + React); `extensions/*` (theme app extension, web pixel, etc.).
- **Single Express process** owns routing, session middleware, static assets, and API handlers. No separate BFF service.

## Sessions vs application data

| Concern | Choice | Rationale |
|--------|--------|-----------|
| **OAuth session storage** | **Redis** via `@shopify/shopify-app-session-storage-redis` | Fits multi-instance hosting; sessions are short-lived tokens, not business entities. Configured in `web/shopify.js` (`REDIS_URL`). |
| **App-owned data** | **MongoDB** (`MONGODB_URI`, `MONGODB_DB_NAME`) | Document model matches timers, analytics events, and shop metadata; collections use **JSON schema validators** for strict inserts/updates. |

Keeping sessions in Redis and domain data in Mongo avoids overloading one store with both concerns and matches typical Shopify app scaling patterns.

## Multi-tenancy

- Every persisted entity that belongs to a merchant is keyed by **`shop`** (normalized domain, e.g. `store.myshopify.com`), consistent with Shopify session `shop`.
- API handlers resolve the current shop from **`res.locals.shopify.session`** after authenticated middleware; list/detail queries always filter by that shop.

## API surface: public vs authenticated

| Layer | Routes (examples) | Auth | Purpose |
|-------|-------------------|------|---------|
| **Public (storefront)** | `GET /api/public/timer`, `POST /api/public/analytics` | None; **CORS** enabled; callers pass **`shop`** (and product context) in query/body | Theme and pixel cannot use admin OAuth. Data is scoped by `shop` + product (and related rules in code). |
| **Authenticated (admin)** | `GET/POST/DELETE` under `/api/timers`, `GET /api/analytics/summary`, etc. | `shopify.validateAuthenticatedSession()` on `/api/*` (see `web/index.js`) | Embedded app and `useAuthenticatedFetch` (shop + host query params). |

**Decision:** Public routes are registered **before** the global authenticated session middleware so the storefront does not need a session cookie.

## Timers (domain model)

- Stored in Mongo with **validated schema** (`web/db/timers.js`): timer type (fixed window vs evergreen), scope (all products, selected products, selected collections), UTC window, evergreen duration, status.
- **IDs only in the database** for products/collections (normalized numeric / GID parsing on write). Human-readable titles are **not** duplicated as the source of truth.

## Enriching timer detail with Shopify titles

**`web/lib/enrichTimerTitles.js`** loads product/collection **titles** for the admin timer detail view by calling the **Admin GraphQL `nodes`** query with the offline/online session. That avoids schema churn and stale titles in Mongo while keeping list/filter logic ID-based.

If GraphQL fails, the API still returns `resolvedProducts` / `resolvedCollections` with `title: null` so the UI can fall back to IDs.

## Analytics

- Events are **append-only** documents (`IMPRESSION`, `ADD_TO_CART`) with `shop`, `productId`, optional `timerId`, `timestamp`, optional `sessionId`/`source`.
- **Summary** for the admin dashboard aggregates counts in Mongo (shop-wide by default; optional filters in query where implemented).
- **Conversion rate** is defined in app logic as add-to-cart count divided by impressions (percentage), not Shopify’s order conversion.

## Admin frontend

- **Vite + React + Polaris**; **file-based routes** under `web/frontend/pages` (`Routes.jsx`).
- Data fetching uses **`useAuthenticatedFetch`**, which appends `shop` and `host` for embedded requests (required for session resolution).
- **App Bridge `SaveBar`** expects **native `<button>` elements** with plain text children; Polaris `<Button>` inside SaveBar can break App Bridge. Primary actions elsewhere use Polaris normally.

## Theme & extensions

- **Theme app extension** (`extensions/countdown-timer`): Liquid block + JS asset talks to **`/api/public/timer`** using the storefront’s product/collection context and `shop` in the query string.
- **Web pixel** (if enabled) can complement analytics; event naming and payloads should stay aligned with `web/db/analytics.js` sanitization.

## Security & privacy notes

- Public endpoints rely on **knowing `shop` + product context**; they are not a full substitute for server-side authorization of sensitive admin operations. Rate limiting and abuse monitoring are recommended for production traffic to public analytics/timer endpoints.
- **Privacy webhooks** path is configured on the Shopify app; keep handlers in sync with Partner Dashboard requirements.

## Configuration files

- **`shopify.app.toml`**: app URL, scopes, auth URLs (CLI sync in dev).
- **`web/shopify.js`**: API version, scopes, Redis session, webhook path.

For day-to-day setup and CLI commands, see the main [README](./README.md).
