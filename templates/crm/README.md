# Kestrel CRM

> A sales CRM for a small team: pipeline board, contacts, tasks, assistant.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/crm-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-crm --template crm
```

## What's inside

A sales CRM for a team of two to ten, built around the pipeline:

- **Pipeline** (`/`) — open deals by stage, with value, close date and owner on every card, and
  four figures above the board: open pipeline, weighted forecast, won and stalled deals.
  Won and Lost are folded columns; drag a card to move a deal on.
- **Contacts** and **Companies** — grids that open a record in a drawer, with the person's
  deals and tasks (or the company's people and deals) listed beneath.
- **Tasks** — every follow-up on a month calendar, with your own open tasks beside it.
- **Assistant** — a records assistant that reads and edits the four tables.
- A deal-won email to the sales inbox, and sign-up closed: an admin adds each account.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree —
no application code. Edit the config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, AI).

## What to try

Load the demo data first. It creates two accounts and a month of sales work, dated
relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **ines.moreau@kestrel.example** (admin) or **tom.achebe@kestrel.example**
(member), with the password you chose. Then:

1. On the **Pipeline**, read the four figures, open the folded Won column, and drag a deal
   into the next stage.
2. Open **Contacts**, select Aisha Nwosu, and see her open deal and her next task.
3. Open **Tasks**: two are overdue and one is due today.
4. Sign in as Tom: a member moves and edits deals, but only an admin deletes one.

> The assistant needs an AI provider (`AI_PROVIDER` + `AI_API_KEY`, or a local
> [Ollama](https://ollama.com) via `AI_BASE_URL`). Without one, deploy anyway — the rest of
> the app works and the Assistant page says what to set.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/crm`](https://github.com/sovrium/sovrium/tree/main/templates/crm)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
