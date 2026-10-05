# Sovrium Hello World

> The one-page starter. Where every app begins.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/hello-world-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-hello-world --template hello-world
```

## What's inside

One file, one page. The page says the app runs, shows the lines of
[`app.yaml`](./app.yaml) that make it, and links the documentation and the other
templates. Any address that answers nothing gets a 404 page with the way back. The page
follows the system's light or dark scheme.

Everything is declared in `app.yaml` — no application code, and no `config/` tree to
split it across. [`app.ts`](./app.ts) is the same app in TypeScript, kept in sync; start
whichever you prefer.

## Run locally

```bash
sovrium start app.yaml --watch
```

Open the address it prints, change the heading in `app.yaml`, and save: `--watch`
reloads the page. Write your own page at `/` and the starter page is gone.

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, AI).

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/hello-world`](https://github.com/sovrium/sovrium/tree/main/templates/hello-world)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
