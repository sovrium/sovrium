# Orrin OS

> A small company's sales, delivery, support and team in one app, around one list of clients.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/company-os-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-company --template company-os
```

## What's inside

Four modules sharing one database, grouped in the sidebar — and every one of them names a
client the same way, because there is only one list of clients:

- **Home** (`/`) — one figure per module (open pipeline, active projects, open tickets, time
  off waiting on a decision), the open pipeline by stage and by client, and what waits on
  you across all four: an urgent ticket, a late task, a passed close date, the requests to
  decide.
- **Sales** — the **Pipeline**, open deals by stage with their client, value, close date and
  owner; Won and Lost are folded columns. **Companies** lists every client with its account
  manager, and opens one in a drawer with its deals, projects and tickets.
- **Delivery** — every **project** with its client, owner, dates and progress, and a board of
  the tasks. Winning a deal opens its project here by itself.
- **Support** — **tickets** by status, each with the contact who raised it, the client and who
  holds it. Resolving a ticket emails its contact.
- **People** — **team and time off**: who is away this month, by name, the requests waiting on
  a decision, and the team. A new request asks the admins to approve it.
- **Assistant** — one AI assistant that reads every module, so "what is open with Northwind,
  and who holds its tickets?" is one question.
- Optional: each morning, the invoices you issued in Pennylane filed into an admin-only
  `customer_invoices` table. It is the `pennylane-invoices-to-table` recipe from the Sovrium
  library (`sovrium library add recipe/pennylane-invoices-to-table`); set
  `PENNYLANE_API_TOKEN` to turn it on — without it the app runs exactly the same.

Sign-up is closed: an admin adds each account. Everything is declared in
[`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no application code. Edit the
config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, AI, demo data).

## What to try

Load the demo data first. It creates nine accounts — the team of Orrin & Co, a small agency —
six clients, nine deals, six projects, eight tasks, eight tickets and five time-off
requests, dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **priya.raghunathan@orrin.example** (admin, runs operations) or
**hannah.okonkwo@orrin.example** (member, an account manager), with the password you chose.
Then:

1. On **Home**, read the four figures and what waits on you: Northwind's urgent ticket, a task
   eleven days late, a deal past its close date, three time-off requests.
2. On the **Pipeline**, drag "Helios — clinical systems pilot" to Won.
3. Open **Projects**: the project that win opened is on top, for Helios Health Group.
4. Open **Companies** and click Northwind Logistics: its two deals, its planned project and
   its two open tickets, in one drawer.
5. On **Tickets**, expand the folded Resolved column; on **Team & time off**, see who is away
   this month.
6. Sign in as Hannah: a member works every module, but only an admin deletes a client.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

> **The demo accounts are for trying the app, not for running it.** The seed gives every
> account it creates, the admin included, the one password in `SOVRIUM_SEED_PASSWORD`, and
> their addresses are published in this README. Before anyone else can reach the app, choose
> a long password or skip the seed, and change or delete the demo admin. Sign-up is already
> closed (`allowSignUp: false`), so nobody can add an account of their own.

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/company-os`](https://github.com/sovrium/sovrium/tree/main/templates/company-os)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
