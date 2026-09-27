# Brunel Stock

> A stock workspace for a small distributor: products, stock per warehouse, orders, suppliers.

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

A stock workspace for a team of two to ten, built around what you hold, where, and what to
buy next:

- **Products** (`/`) — the catalogue grouped by category, with stock on hand, reorder point
  and value at cost per product, totalled per category and for the whole catalogue. The
  products under their reorder point are marked, and the **Reorder list** tab keeps only
  those. A product opens in a drawer with every movement that made its stock.
- **Stock** — every movement in and out, signed and dated, grouped by warehouse with the net
  per warehouse: receipts, picks, transfers as a pair of rows, and counts.
- **Orders** — customer orders by status, each card with its lines, units and value. Shipped
  and Cancelled are folded columns; drag a card to move an order on.
- **Suppliers** — who you buy from, with each one's lead time.
- **Assistant** — ask what to reorder and from whom, and have it draft the purchase order
  (needs an AI provider, see below).

Stock on hand is never typed: it is the sum of the product's movements, so it cannot drift
from the ledger. Sign-up is closed; an admin adds each account.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree —
no application code. Edit the config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
AI provider, email, demo data). The assistant stays off until `AI_PROVIDER` is set; every
other page works without it.

## What to try

Load the demo data first. It creates two demo accounts, eleven products in three warehouses,
a month of stock movements, eight orders and three purchase orders, dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **elise.brunel@brunel-fils.example** (admin, the stock manager) or
**maxime.vidal@brunel-fils.example** (member, the warehouse operator), with the password you
chose. Both are demo accounts. Then:

1. On **Products**, read the totals per category and the four products marked Reorder or
   Out of stock; open the **Reorder list** tab.
2. Open the void-fill paper: 34 on hand in Lyon South, and the delivery, the pick and the
   count that got it there.
3. On **Stock**, find the transfer from Lille to Lyon: one reference, two signed rows.
4. On **Orders**, Cardinal Freight's order is being picked; expand the folded Shipped column.
5. Sign in as Maxime: a member records movements and moves orders, but only an admin deletes
   a product.

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
