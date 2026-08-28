# Sovrium Inventory

> Products, stock, and orders — an Airtable alternative you own.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/inventory-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-inventory --template inventory
```

## What's inside

Six linked tables — suppliers, warehouses, products, stock movements, orders, and order
lines — behind spreadsheet-style grids with grouping, saved views, filters, footer
summaries, inline editing, and an expand-record side panel. Plus an AI assistant that
reads and edits records, and an automation that emails purchasing when stock hits zero.

The products table is deliberately wide: it is the reference surface for Sovrium's field
types, from select chips and attachments to rollups, lookups, and database-computed
formulas. Use the grid's **Hide fields** control rather than deleting columns.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree —
no application code. Edit the config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, AI).

> The assistant and the AI columns on suppliers need an AI provider (`AI_PROVIDER` +
> `AI_API_KEY`, or a local [Ollama](https://ollama.com) via `AI_BASE_URL`). Without one,
> deploy anyway — the rest of the app works and those columns stay empty.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/inventory`](https://github.com/sovrium/sovrium/tree/main/templates/inventory)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
