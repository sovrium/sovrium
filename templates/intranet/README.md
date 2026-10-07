# Halden Intranet

> A company intranet: the must-read first, the news, a searchable directory, the resources, and a Publish page for managers.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/intranet-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-intranet --template intranet
```

## What's inside

- **Welcome** (`/`) — the public door: what the hub holds and one way in. It names nobody.
- **Sign-in** (`/sign-in`) — a work email and a link sent to it, no password to remember.
  "Use a password instead" opens the password form on its own page (`/sign-in/password`).
- **Home** (`/portal`) — the must-read on top, with its acknowledge-by date and how many
  colleagues have acknowledged it ("31 of 46"); the latest news with who wrote it; what is
  coming up; who joined in the last 30 days; and the tools. A search box finds the hub's
  pages you may open. An announcement's title opens it in a drawer.
- **News** — every announcement, newest first, with an index beside it that narrows by
  topic or by a word of the title.
- **People** — everyone at the company with their role, team, office and manager; search by
  name, narrow by team or office.
- **Resources** — guides, policies and tools, grouped, each with its address.
- **Publish** (managers only) — write an announcement; give it an "acknowledge by" date to
  make it a must-read. It is signed with your name and lands on everyone's Home.
- Optional: each new announcement is also posted in your Microsoft Teams channel. It is the
  `record-to-teams-channel` recipe from the Sovrium library (`sovrium library add
recipe/record-to-teams-channel`); set the Microsoft variables in `.env.example` to turn it
  on — without them the app runs exactly the same.

Sign-up is closed: IT adds each colleague. Everything is declared in
[`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no application code. Edit the
config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, demo data). The sign-in link needs SMTP; until you configure it, sign in with a
password.

## What to try

Load the demo data first. It creates eight accounts at Halden, a software company with six
offices, and a directory of forty-six colleagues — thirty-eight of them invented to fill it
out — with six announcements, dated relative to today:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

1. Open `/sign-in`, choose **Use a password instead** and sign in as
   **jules.marchand@halden.example** (member). Home greets you with the security training
   on top: acknowledge within six days, 31 of 46 done.
2. Open the must-read from its title: who wrote it, what it asks and the full text.
3. On **People**, search for **Keiko**: data and reporting, in Berlin.
4. Sign in as **priya.raghunathan@halden.example** (a manager). **Publish** appears in the
   navigation. Publish an announcement with an acknowledge-by date: it tops everyone's Home.
5. Sign in as **omar.haddad@halden.example** (IT, the admin), the only one who can delete an
   announcement.

The acknowledgements are demo data: the app counts them, but has no Acknowledge button yet.
A post is addressed to the whole company; one team or one office only is not something an
announcement can be limited to.

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
(source: [`templates/intranet`](https://github.com/sovrium/sovrium/tree/main/templates/intranet)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
