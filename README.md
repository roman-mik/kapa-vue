# Kapa — Pocket and Horizon

Vue 3 client for [Kapa](https://github.com/roman-mik/kapa-core), a family of household money
apps: **Pocket**, a monthly spending-cap tracker, and **Horizon**, a day-by-day, multi-currency
cashflow projector. All business logic, queries, and theming live in the private
`@roman-mik/kapa-core` package; this repo is the Vite + Vue 3 SPA that renders them, including
the public landing page below.

**Live:** [kapa-vue.vercel.app](https://kapa-vue.vercel.app)

![Kapa landing page — "What's left this month. When it gets tight."](docs/landing.png)

## Pocket — shipped

A monthly spending cap, one tap per expense, always know what's left. The landing page's demo
panel isn't a mockup — it calls the same `@roman-mik/kapa-core` functions
(`remaining`, `safeDaily`, `spentPct`, `projection`, `pocketHomeView`) that the signed-in app
runs against real data.

## Horizon — shipped

A day-by-day cashflow projection across accounts, currencies, and pay schedules — built to
answer the question Pocket can't: not just what's left this month, but when a comfortable
month-end balance hides a mid-month shortfall. Today, Timeline, accounts, income, obligations,
planned spend, warnings and settings use the projection engine in `kapa-core`. The public
landing demo remains a deterministic fixture.

## Architecture

- **`@roman-mik/kapa-core`** (private) — shared domain logic, Supabase queries, and theme
  tokens, consumed by this Vue SPA and the [Next.js `kapa`](https://github.com/roman-mik/kapa)
  app.
- **Supabase / Postgres** — the shared backend, with row-level security enforced at the
  database rather than the app layer.
- **This repo** — a Vite + Vue 3 SPA, offline-capable as an installable PWA.

### Client server state

`useSpaceQuery` shares remote data through an in-memory Vue cache. Keys contain the
authenticated user, space, resource and query parameters (month/timezone, category archive
filter, FX cutoff date or projection range). Financial calculations remain in `kapa-core`;
Pinia owns session, selected space and preferences.

Resource data stays fresh for 30 seconds; dated FX snapshots use one hour. Mounting a
consumer reuses fresh data and refetches stale data; explicit `refresh()` forces a read.
Stale data remains visible during refresh, with a separate reactive loading flag and error.
This is an in-memory read cache, without persistence, offline writes or automatic polling.

Mutations invalidate all variants of their resource in the captured user/space. The
dependency map in `src/lib/serverState/invalidation.ts` refreshes affected projections;
calendar changes also refresh income and obligations. Concurrent reads share a promise,
and generations prevent invalidated requests from replacing newer data. Space switches
select another entry immediately; auth changes clear all cached data.

When adding a resource, include every query argument in its key, read captured parameters
inside its loader, and declare mutation dependencies in the invalidation map. Capture
`query.invalidate` before awaiting a write so changing space cannot invalidate another
space's data.

## Engineering

- Row-level security enforced at the database, not just the app layer.
- pgTAP tests plus integration tests run through a real per-user JWT, so RLS is verified, not
  assumed.
- Generated Supabase types diffed in CI — a migration without regenerated types fails the
  build.
- Money stored as minor-unit integers everywhere; rounding happens only at display.
- FX rates are dated snapshots, converted at display time — never live-fetched at render.
- Offline-capable PWA with an installable app shell.

## Getting started

### Prerequisite: `NPM_TOKEN`

`@roman-mik/kapa-core` is a **private** package published to GitHub Packages, even though this
repo is public. Installing will fail with `401 Unauthorized` unless you have:

1. A **classic** GitHub PAT with `read:packages` scope (fine-grained tokens don't work for
   GitHub Packages).
2. That token exported as `NPM_TOKEN`, referenced from your **user-level** `~/.npmrc` (the
   underlying package manager refuses to expand env vars in a project-level `.npmrc`, since
   that file is committed):

   ```
   //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
   ```

3. `NPM_TOKEN` set in your shell (`export NPM_TOKEN=...`) before installing, and as a repo/env
   secret in CI and Vercel.

The project's own `.npmrc` only maps the `@roman-mik` scope to the registry — it intentionally
does not carry the auth token.

### Commands

This project is built with [Vite+](https://vite.plus) — use `vp`, not `pnpm`, for everything:

```
vp install
vp dev
vp build
vp test
vp check
```
