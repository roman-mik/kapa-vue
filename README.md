# kapa-vue

Vue 3 client for [Kapa](https://github.com/roman-mik/kapa-core) — a family of personal-finance
apps (**Pocket**, a monthly spending cap tracker, and **Horizon**, cash-flow forecasting). All
business logic, queries, and theming live in `@roman-mik/kapa-core`; this repo is the Vite +
Vue 3 SPA that renders them.

## Prerequisite: `NPM_TOKEN`

`@roman-mik/kapa-core` is a **private** package published to GitHub Packages, even though this
repo is public. `pnpm install` will fail with `401 Unauthorized` unless you have:

1. A **classic** GitHub PAT with `read:packages` scope (fine-grained tokens don't work for
   GitHub Packages).
2. That token exported as `NPM_TOKEN`, referenced from your **user-level** `~/.npmrc`
   (pnpm refuses to expand env vars in a project-level `.npmrc`, since that file is committed):

   ```
   //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
   ```

3. `NPM_TOKEN` set in your shell (`export NPM_TOKEN=...`) before running `pnpm install`, and as
   a repo/env secret in CI and Vercel.

The project's own `.npmrc` only maps the `@roman-mik` scope to the registry — it intentionally
does not carry the auth token.

## Development

```
pnpm install
pnpm dev
pnpm build
```
