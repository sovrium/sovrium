# Marketing site

> A marketing website built from every marketing block of the library.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/marketing-site-template)

## Use this template

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-site --template marketing-site
```

## What's inside

Nine pages, each a stack of blocks from the Sovrium library — heroes, logo walls, feature
grids, figures, testimonials, pricing tables, FAQs, team, blog lists, a long read with its
outline, contact forms, a newsletter sign-up and two pages for lost visitors. Each file
under [`library/block/`](./library/block) starts with the line naming the block and the
version it came from.

Copy in square brackets — `[Product]`, `[Primary action]` — is a placeholder: replace it
with your own words, and delete the blocks a page does not need. The blog sections read the
`posts` table and the live figures read `orders`; point them at your own tables with
`sovrium library add block/<name> --set table=<yours>`.

The site speaks English and French. Every word that changes with the language is a key in
[`config/languages.yaml`](./config/languages.yaml), and the blocks cite it as `$t:<key>`:
`/en/…` and `/fr/…` serve a page in that language, and the switcher in the header opens the
same page in the other one. The home hero, the pricing page, the headers and the footers
are translated; add a key and its two values to translate the rest.

The contact forms post to the `contact` form in [`config/forms/`](./config/forms), which
writes each message to the `messages` table. Only the owner reads it: sign in at `/login`
with the `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD` you set, then open the admin. The
newsletter blocks post to the `newsletter` form the same way, into a `subscribers` table.

## Run locally

```bash
sovrium seed app.yaml     # four posts and a few orders
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. Set
`AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD` to read the contact messages.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/marketing-site`](https://github.com/sovrium/sovrium/tree/main/templates/marketing-site)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
