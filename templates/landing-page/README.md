# Tablée — a landing page

> A bilingual product landing page with a demo request the owner reads in the admin.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/landing-page-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-landing-page --template landing-page
```

## What's inside

The landing page of Tablée, a fictional booking product for independent restaurants, at
`/en/` and `/fr/`: one sentence about what it does, the product itself (Friday's dinner as
it shows it), three things it does, three steps to start, and a demo request. The French
page is written in French, and the language switcher keeps the reader's place. The page
claims no figure it cannot prove.

A request lands in the `demo_requests` table, which only the owner reads, in the admin at
`/_admin`. Nobody can open an account; the owner comes from `AUTH_ADMIN_EMAIL` and
`AUTH_ADMIN_PASSWORD`. Each language shares with its own PNG card (`public/og-en.png`,
`public/og-fr.png`); the site follows the system's light or dark scheme.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no
application code. The words are in `config/languages.yaml`; rename the product there.

## Run locally

```bash
sovrium start app.yaml --watch
```

Zero-config: embedded SQLite, local file storage. Set `AUTH_ADMIN_EMAIL` and
`AUTH_ADMIN_PASSWORD` (see [`.env.example`](./.env.example)) to read the requests in the
admin. The sharing cards are sent as full addresses on the host the site is served at, so
nothing needs replacing before you deploy.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/landing-page`](https://github.com/sovrium/sovrium/tree/main/templates/landing-page)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
