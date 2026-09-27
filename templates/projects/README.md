# Fernhill Projects

> A project workspace for a small team: dashboard, task board, timeline, calendar.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/projects-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-projects --template projects
```

## What's inside

A project workspace for a team of three to fifteen, built around who does what by when:

- **Dashboard** (`/`) — four figures (active projects, open tasks, overdue tasks, budget
  committed), open work by status and by person, the tasks already late, and every project
  with its owner, dates, progress and budget.
- **Board** — open tasks by status, each card with its project, due date and person. Done
  is a folded column; drag a card to move a task on, or open it in a drawer to see what it
  waits on and what waits on it.
- **Timeline** — every task as a bar from its start to its due date, grouped by project,
  with a link to the task it waits on and a rule at today.
- **Calendar** — the month's deadlines, with your own open tasks beside them.
- An email to a task's assignee when it turns Blocked, and sign-up closed: an admin adds
  each account.

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

Load the demo data first. It creates five accounts, six projects and eighteen tasks, dated
relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **camille.roux@fernhill.example** (admin, the project lead) or
**jonas.weber@fernhill.example** (member), with the password you chose. Then:

1. On the **Dashboard**, read the four figures and the two tasks already late.
2. Open the **Timeline**: the checkout rebuild waits on the payment vendor's keys, and the
   Ledger migration's sign-off waits on its dry run.
3. On the **Board**, open "Collect DPAs from every sub-processor" to read what is holding it
   up and which task waits on it; expand the folded Done column.
4. Open the **Calendar**: the month's deadlines, and your own open tasks beside them.
5. Sign in as Jonas: a member adds and moves tasks, but only an admin deletes one.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/projects`](https://github.com/sovrium/sovrium/tree/main/templates/projects)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
