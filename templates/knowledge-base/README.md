# Corvel handbook

> A private company handbook: markdown articles in sections, a managers' section, a search and an assistant — behind sign-in.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/knowledge-base-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-knowledge-base --template knowledge-base
```

## What's inside

- **Welcome** (`/`) — the public door: the three sections, by name and purpose, and one way
  in. It names no article.
- **Sign-in** (`/sign-in`) — a work email and a password. Sign-up is closed: a new colleague
  is added by their manager.
- **The handbook** (`/kb`) — the start page: where to begin and what changed recently.
  Beside every article, the sections; above it, a search box; in it, the outline, the date it
  was last updated, and previous / next that follow the sidebar across sections. A policy
  past its review date carries a warning callout.
- **For managers** (`/kb/managers/…`) — hiring and pay reviews. Managers and the admin see it
  in their sidebar; a member's page carries none of its links, the search never offers them,
  and asking for one sends them to sign in.
- **Ask the handbook** (`/assistant`) — an assistant that answers from the five articles
  everyone may read. It needs an AI provider.

Every article is a plain markdown file under [`content/`](./content), versioned with the
rest of the app; `/llms.txt` and the sitemap list none of them, because the handbook is
private. Everything else is declared in [`app.yaml`](./app.yaml) and the
[`config/`](./config) tree — no application code. Edit a file, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
demo accounts, AI).

## What to try

Create the two demo accounts first:

```bash
SOVRIUM_SEED_PASSWORD=choose-a-password sovrium seed app.yaml
sovrium start app.yaml
```

1. Sign in as **lea.bernard@corvel.example** (a member, on her first week). The handbook
   opens on its start page: the three sections and what changed recently.
2. Open **Your first week**: the outline beside it, the date it was last updated, and next —
   **Setting up your laptop**, in the IT section.
3. Open the **Expense policy**: a warning says it is past its review date.
4. Search for **expense** in the bar: the policy is among the answers.
5. Sign in as **hannah.okafor@corvel.example** (the admin who owns the handbook). A **For
   managers** section appears under the sidebar; Léa never sees it.

To add an article, write a markdown file under `content/kb/<section>/` with a `title`, a
`category`, an `order` and an `updated` date in its frontmatter.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/knowledge-base`](https://github.com/sovrium/sovrium/tree/main/templates/knowledge-base)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
