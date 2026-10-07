# Tallyline Support

> A small team's helpdesk: a public ticket form, one queue, and a rating once it is solved.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/helpdesk-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-helpdesk --template helpdesk
```

## What's inside

- **Contact support** (`/`, public) — one form with a screenshot or a file, no account, and
  what happens after sending beside it. A ticket arrives as New, stamped with when its first
  reply is due, and the team's inbox is told (set its address in
  `config/automations/when-a-ticket-arrives.yaml`).
- **Queue** (`/triage`) — every ticket by status with who asked, its priority and who holds
  it. Four counts on top, one filter bar, and three tabs: the tickets nobody holds yet, yours,
  and all of them. Resolved and closed tickets fold away until you open them; drag a card to
  change its status.
- **All tickets** — every ticket ever filed, newest first. Open one and it slides in over the
  grid with its details and its conversation: what the requester wrote, the replies and the
  internal notes.
- **A ticket's own page** (`/tickets/<id>`, from "Open full page" in the drawer) — what the
  requester wrote and the team's internal notes, the table's comment thread. Each new note is
  collected, and on weekday mornings at 08:30 one digest email lists them all; a morning with
  no note sends nothing.
- **Reports** (admin) — where the tickets stand, and the volume by topic.
- **Rate this answer** (`/rate`, public) — when a ticket is marked Resolved, the requester is
  emailed a link to rate the answer, one rating per ticket.
- Optional: each ticket filed as a Bug report becomes an issue in your Linear team. It is the
  `record-to-linear-issue` recipe from the Sovrium library (`sovrium library add
recipe/record-to-linear-issue`), narrowed to bug reports; set `LINEAR_API_KEY` and
  `LINEAR_TEAM_ID` to turn it on — without them the app runs exactly the same.

Sign-up is closed: an admin adds each agent. Everything is declared in
[`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no application code. Edit the
config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, demo data).

## What to try

Load the demo data first. It creates two accounts — the support team of Tallyline, a small
software company — and fourteen tickets from the last two weeks, dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

Sign in as **clara.dumas@tallyline.example** (admin, leads the team) or
**yann.kerbrat@tallyline.example** (member), with the password you chose. Then:

1. Land on the **Queue**: nine open tickets, two that nobody holds, one urgent.
2. Open the public page `/` in a private window and send a ticket with a screenshot. It
   appears in New on the Queue.
3. Pick **Mine** to see only the tickets you hold, then drag one to Waiting on customer.
4. On **All tickets**, open the VAT invoice ticket to read its conversation, including
   Clara's internal note.
5. Mark a ticket Resolved: the requester is emailed a link to rate the answer (with email
   configured). **Reports** shows the week in four counts.

A ticket takes one rating. The rating page needs no account, because the requester has
none, and ticket ids are plain sequential numbers, so the link is not a secret: anyone can
rate any ticket, and the first rating is the one counted. Read a rating as a signal next to
its ticket, not as proof of who gave it.

New tickets are announced to the team's inbox, not to the requester: the requester's
address comes from a public form, and mailing it automatically would let anyone make your
domain send their text to any inbox. Put your team's address in
`config/automations/when-a-ticket-arrives.yaml`.

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
(source: [`templates/helpdesk`](https://github.com/sovrium/sovrium/tree/main/templates/helpdesk)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
