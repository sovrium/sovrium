# Arden Assets

> An asset register for a small firm: what it owns, who holds it, where it is, what is due back.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/assets-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-assets --template assets
```

## What's inside

An asset register for a firm of five to fifty, built around what you own, who has it and
where it is:

- **Register** (`/`) — everything the firm owns grouped by category, with each asset's tag,
  holder, place, purchase date and value, and the value totalled per category. Four figures
  above it: what the kit in service is worth, how much is checked out, what needs attention
  and which warranties are ending. An asset missing at the last count, due back today,
  overdue or near the end of its warranty carries one word beside its name. An asset opens in
  a drawer with its check-outs and its history.
- **Lifecycle** — the assets by stage: in storage, in use, in repair. Retired is a folded
  column; drag a card to move an asset on.
- **Gallery** — the assets in service as cards, to walk the floor with; pick a location to
  see what should be there.
- **Locations** — the offices, the storeroom, the repair shop, and Remote for kit that lives
  at someone's home.

A holder is a person with an account, never a name typed into the asset's name, and each
hand-over is a check-out with its return date. Every asset has a unique tag and a unique
barcode. Sign-up is closed; an admin adds each account.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree —
no application code. Edit the config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, demo data).

## What to try

Load the demo data first. It creates five demo accounts, five locations, fourteen assets,
their check-outs and their history, dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **claire.arden@arden.example** (admin, the office manager) or
**tomas.ferreira@arden.example** (member, who holds a laptop), with the password you chose.
Both are demo accounts. Then:

1. On the **Register**, read the four figures, the value per category, and the two marked
   assets: the MacBook due back today and the monitor missing at the last count.
2. Open the MacBook Tomás has: its return date, its two check-outs, and its history back to
   the day it was registered.
3. On **Lifecycle**, drag the spare MacBook Air from In storage to In use; expand the folded
   Retired column.
4. On **Gallery**, pick Paris HQ and walk the floor with the cards.
5. Sign in as Tomás: a member hands assets over and takes them back, but only an admin
   deletes one.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/assets`](https://github.com/sovrium/sovrium/tree/main/templates/assets)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
