<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://sovrium.com/logos/sovrium-icon-light.svg" />
    <img src="https://sovrium.com/logos/sovrium-icon-dark.svg" alt="Sovrium" width="88" height="88" />
  </picture>
</p>

<h1 align="center">Sovrium</h1>

<p align="center">
  <strong>Write one config file. Run a complete web app.</strong><br />
  Database, REST API, sign-in, pages, forms, automations, AI agents and an admin
  console, interpreted from YAML, JSON or TypeScript by a single binary you run
  wherever you like.
</p>

<p align="center">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License: Business Source License 1.1" /></a>
  <a href="https://github.com/sovrium/sovrium/releases/latest"><img src="https://img.shields.io/github/v/release/sovrium/sovrium?label=release" alt="Latest release" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun_1.4-f472b6" alt="Runtime: Bun 1.4" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6.0-3178c6" alt="TypeScript 6.0" /></a>
</p>

<p align="center">
  <a href="https://sovrium.com">Website</a> &middot;
  <a href="https://sovrium.com/docs">Docs</a> &middot;
  <a href="#quick-start">Quick start</a> &middot;
  <a href="#cli-reference">CLI</a> &middot;
  <a href="#templates">Templates</a> &middot;
  <a href="CHANGELOG.md">Changelog</a> &middot;
  <a href="https://github.com/sovrium/sovrium/issues">Issues</a>
</p>

---

## See it in ten seconds

**1. Write a config.** Twenty lines of YAML:

```yaml
# app.yaml
name: my-crm

tables:
  - id: 1
    name: contacts
    fields:
      - { id: 1, name: name, type: single-line-text, required: true }
      - { id: 2, name: email, type: email, unique: true }
      - { id: 3, name: status, type: single-select, options: [Lead, Active, Lost] }

auth:
  strategies:
    - type: emailAndPassword

pages:
  - name: home
    path: /
    components:
      - { type: text, element: h1, content: My CRM }
      - { type: table, dataSource: { table: contacts } }
```

**2. Run one command.**

```bash
sovrium start app.yaml
# → http://localhost:3000
# → Admin console: http://localhost:3000/_admin/login
```

**3. Here is what you now have** — every row observed on a running instance of exactly
that file:

| You get                    | Concretely                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A database table, migrated | `contacts` in embedded SQLite (or PostgreSQL with `DATABASE_URL`): `name NOT NULL`, a unique index on `email`, a `CHECK` on `status`, timestamps and a soft-delete column        |
| A REST API for it          | `GET` / `POST /api/tables/contacts/records`, `GET` / `PATCH` / `DELETE …/records/{recordId}`, plus batch, upsert, CSV import, aggregate, trash and restore, history and comments |
| Validation on every write  | a missing `name` or an unknown `status` → `400`, a duplicate `email` → `409`                                                                                                     |
| Sign-up and sign-in        | email and password under `/api/auth/*`, with sessions; `admin`, `member` and `viewer` roles; anything a caller may not see answers `404`, never `403`                            |
| A server-rendered page     | `/` with the heading and a sortable, filterable grid of the contacts the visitor may read                                                                                        |
| An admin console           | `/_admin`: records, automation runs, form submissions, users, files and analytics, for admins only                                                                               |
| An API description         | OpenAPI 3.1 at `/api/openapi.json` and `/api/auth/openapi.json`, and an interactive explorer at `/api/scalar`, for admins only                                                   |
| The basics a site needs    | `/sitemap.xml`, `/robots.txt`, `/api/health`, hardened response headers, CSRF protection and rate limiting                                                                       |

|                           | Without Sovrium                                                                    | With Sovrium                                   |
| ------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| To ship the app above     | a schema, migrations, an API layer, an auth library, a frontend and an admin panel | one file, read by one binary                   |
| To change a field         | edit the schema, write a migration, update the API and the UI                      | edit one line; the database, API and UI follow |
| To review what the app is | read the code across every layer                                                   | read the config, diff it in Git                |

There is no code generation step: Sovrium **interprets** the config at runtime, so the
file stays the single source of truth. Under `sovrium start --watch`, saving the file
reloads the running app.

---

## Table of contents

- [What Sovrium is](#what-sovrium-is)
- [Features](#features)
- [How it works](#how-it-works)
- [Install](#install)
- [Quick start](#quick-start)
- [Templates](#templates)
- [CLI reference](#cli-reference)
- [Configuration](#configuration)
- [Built for AI agents](#built-for-ai-agents)
- [Deploy](#deploy)
- [Where Sovrium fits](#where-sovrium-fits)
- [Free and paid](#free-and-paid)
- [How this is built and tested](#how-this-is-built-and-tested)
- [Documentation](#documentation)
- [Status](#status)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## What Sovrium is

Sovrium is a **configuration-as-code interpreter**. You describe what your application
contains (tables, roles, pages, forms, automations, agents) in one configuration file,
and the binary builds and runs the whole application from it, together with the
operational console to run it.

- **Sovrium is** a way to build internal tools, CRMs, back offices, client portals,
  content sites, documentation sites and APIs from a file you keep in Git.
- **Sovrium is not** a framework you program against, a no-code builder you click
  through, or an in-app editor. The configuration is code: it is written in a file,
  reviewed, committed and redeployed.

Sovrium runs on your own machine or server. Sovrium Cloud is the optional managed hosting for teams that would rather not run it themselves.

---

## Features

Each row is a part of the configuration you declare. The
[feature documentation](https://sovrium.com/docs) covers every option.

| Domain                   | What you declare, and what you get                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tables and fields**    | More than fifty field types: text, numbers, currency, dates, selections, relationships, lookups and rollups, attachments, signatures, barcodes, formulas, autonumbers, JSON, geolocation, and AI fields. Indexes, constraints, saved views (or SQL views), per-role and per-field permissions, row scoping, outgoing webhooks, retention windows, soft delete, change history and comments.                                                                                                                                                                                                      |
| **Records API**          | A REST API per table with filtering, sorting, grouping, aggregation, pagination, batch writes, upsert, CSV import and export, optimistic locking, live refresh and full-text search. OpenAPI 3.1 documents generated from the same schemas.                                                                                                                                                                                                                                                                                                                                                      |
| **Authentication**       | Email and password, magic links, email codes, OAuth sign-in, two-factor (TOTP), passkeys, OpenID Connect and SAML single sign-on, SCIM provisioning, invitations, and roles (`admin`, `member`, `viewer`, or your own).                                                                                                                                                                                                                                                                                                                                                                          |
| **Pages and components** | Server-rendered pages built from a component library on [shadcn/ui](https://ui.shadcn.com): data-bound tables, kanban boards, calendars, timelines, charts, KPIs, record detail pages, a ⌘K palette, markdown collections, conversations bound to a table (a composer with typing indicators, replies and unread markers), a notification bell and online presence. Routing with parameters, page-level access rules, interactions; on a page with a sidebar, in-app links swap the content without a full reload, and an app can be installed from its manifest with an optional offline shell. |
| **Forms**                | Public or signed-in forms with validation, conditional logic, file uploads and delivery to a table, an email or an automation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Design**               | One `design` key for colours, type scale, spacing, density, radius, motion and dark mode, plus per-component overrides. Exports to an agent brief, DTCG tokens or a portable bundle with `sovrium design-system`, which can also draw the app's pages for a design tool (a Figma plugin document, a Penpot file or a Claude Design canvas), drawn from seed data, per state, or as a clickable prototype; tokens and reworked pages import back into the config.                                                                                                                                 |
| **Languages and SEO**    | Multi-language apps under `/{lang}/`, translation keys, per-page metadata, sitemap, robots, redirects, short links with click counts, and an `/llms.txt` for your own app.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Automations**          | Triggers on record changes, comments, inbound webhooks, schedules, sign-in events, form submissions, a button, another automation, or a failed run. Actions for data, HTTP and connected services (OAuth2, API keys), email, documents and PDFs, approvals and delays, branches and loops, sub-workflows, TypeScript code steps, browser automation, and seeding or resetting the app's own data. Retries, timeouts, a runs API with replay and cancel.                                                                                                                                          |
| **AI**                   | Bring a provider (Anthropic, OpenAI, Mistral, Google Gemini, local Ollama, or any OpenAI-compatible endpoint), routed local-first by default. AI fields, a chat over your data, agents bound to a role with tool allowlists, human approvals, schedules and usage limits, retrieval over your tables and documents, agent memory, speech-to-text.                                                                                                                                                                                                                                                |
| **MCP**                  | Your app as a Model Context Protocol server over HTTP (tables, automations, actions, behind authentication), your agents as MCP clients of external servers, and `sovrium mcp` serving your config to a local AI client over stdio.                                                                                                                                                                                                                                                                                                                                                              |
| **Files**                | Named buckets on the local disk, S3-compatible storage or PostgreSQL, with per-operation permissions, signed URLs and image transforms.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Operations**           | Embedded SQLite by default, PostgreSQL with one variable, automatic migrations on boot, backup and restore, a deployment bundle, GDPR export and erasure, privacy-first built-in analytics, an activity log, operator email alerts, and opt-in ecodesign levers (`ECO_*`).                                                                                                                                                                                                                                                                                                                       |
| **Admin console**        | `/_admin` on every app with authentication: overview with instance health, records, automation runs (which step failed, how long each took, and whose fault it was), form submissions, users, files, connections, analytics, an audit log, API keys, your design system, and a Report a problem page that prefills a bug report. Admin-only and read-only towards the configuration, which stays code.                                                                                                                                                                                           |
| **Import**               | `sovrium import` brings an app in from another tool: spreadsheets and CSV files, online databases, form builders, website builders and automation platforms. `fetch` reads the tool's API, read-only, into a local snapshot; the conversion then writes tables, seed records, forms, pages and automations into your config, every automation disabled until you enable it, with a report of what did not carry over.                                                                                                                                                                            |
| **Library**              | Ready-made blocks, connections to external services and automation recipes inside the binary. `sovrium library add` copies one into your config as a file you own.                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

## How it works

```text
  app.yaml / app.json / app.ts            sovrium (one binary)                     a running app
 ┌───────────────────────────┐      ┌─────────────────────────────┐      ┌──────────────────────────────┐
 │ tables, auth, pages,      │      │ 1. decode + validate        │      │ /           your pages       │
 │ forms, automations,       │ ───▶ │ 2. migrate the database     │ ───▶ │ /api/...    REST API + auth  │
 │ agents, design, buckets…  │      │ 3. serve, schedule, watch   │      │ /_admin     operator console │
 └───────────────────────────┘      └─────────────────────────────┘      └──────────────────────────────┘
           in your Git                SQLite or PostgreSQL, local             reloads when the file
                                      disk or S3, your AI provider            changes (--watch)
```

1. **Validate.** The config is decoded against one schema. An unknown key or a wrong
   value is refused with a message naming the path and the fix; nothing is silently
   ignored. `sovrium validate` runs this step alone, with no database.
2. **Migrate.** On boot, Sovrium compares the declared tables with the database and
   applies the difference in a transaction.
3. **Serve.** One process serves the pages, the API, authentication, file storage,
   automations and the admin console. Under `--watch`, a saved change reloads the app.

---

## Install

The standalone binary needs neither Node nor Bun.

```bash
# macOS / Linux — install script (verifies the published sha256)
curl -fsSL https://sovrium.com/install | sh

# Homebrew (macOS / Linux)
brew install sovrium/tap/sovrium

# Scoop (Windows)
scoop bucket add sovrium https://github.com/sovrium/scoop-bucket
scoop install sovrium

# Docker
docker pull ghcr.io/sovrium/sovrium:latest
```

**Desktop app.** Sovrium also ships as a desktop app for macOS (`.dmg`, Apple silicon and
Intel), Windows (installer) and Linux (AppImage or `.deb`), from the
[download page](https://sovrium.com/download) or the
[latest release](https://github.com/sovrium/sovrium/releases/latest). It is the same
engine in a window: it creates a project folder from a template, runs the server for
you and shows the app. The config it writes runs unchanged under `sovrium start`.
See [The Sovrium App](https://sovrium.com/en/docs/desktop-app).

> Already installed? `sovrium update` keeps you current whichever way you installed: it
> replaces a raw binary, or hands over to `brew upgrade` / `scoop update`.

> The `sovrium` npm package is **deprecated**: Sovrium ships as a binary, and nothing is
> published to npm. A TypeScript config needs no package either (see
> [Configuration](#configuration)).

**Requirements.** None for a trial: Sovrium defaults to embedded SQLite and local file
storage. For production, point `DATABASE_URL` at PostgreSQL 15+.

---

## Quick start

```bash
# 1. Scaffold an app from a template (drop the template flag for a blank starter)
sovrium init my-crm --template crm
cd my-crm

# 2. Check the config without starting anything
sovrium validate app.yaml
# → Valid configuration: kestrel-crm

# 3. Optional: load the template's sample data (accounts take this password)
SOVRIUM_SEED_PASSWORD='choose-a-password' sovrium seed app.yaml

# 4. Run it, reloading on every save
sovrium start app.yaml --watch
# → http://localhost:3000
```

- **A blank TypeScript starter**: `sovrium init my-app --typescript` writes a typed
  `app.ts` with its `tsconfig.json`. (`--typescript` cannot be combined with
  `--template`: a template ships its own config.)
- **The first admin**: set `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD` before the first
  start, or run `sovrium admin create you@example.com`. The three ways are in
  [Admin & Maintenance](https://sovrium.com/en/docs/cli-admin).
- **A static site**: `sovrium build app.yaml` writes the pages to `./dist` for content
  that needs no server.

---

## Templates

`sovrium init --template <name>` copies a complete, runnable app, and `sovrium templates`
lists the names the binary you run carries. Each one is also
published as its own GitHub repository, which the same flag reads when given
`<owner>/<repo>` instead of a name (for example `sovrium/crm-template`), and each can be
opened from the desktop app.

<details>
<summary><strong>The bundled templates</strong></summary>

<br />

| Template             | What it is                                                                    |
| -------------------- | ----------------------------------------------------------------------------- |
| `hello-world`        | The one-page starter: the first page after `sovrium init`.                    |
| `landing-page`       | A bilingual product landing page with a demo request form.                    |
| `marketing-site`     | A marketing website built from every marketing block of the library.          |
| `blog`               | Essays with covers, moderated comments, RSS and scheduling.                   |
| `docs-site`          | A documentation website from markdown files.                                  |
| `knowledge-base`     | A private company handbook in markdown, with search and an assistant.         |
| `api-only`           | A REST API called with a key, with per-role rules and one landing page.       |
| `mcp-server`         | A team knowledge base that an assistant reads over MCP, with a key.           |
| `crm`                | A sales pipeline with a forecast, contacts, tasks and an assistant.           |
| `projects`           | A dashboard, a task board, a timeline by project and a deadline calendar.     |
| `helpdesk`           | A public ticket form, a queue by who holds each ticket, and ratings.          |
| `content-calendar`   | A month by channel, review approvals and campaigns.                           |
| `people`             | An HR directory with salaries withheld, time off and admin approvals.         |
| `events`             | Events with seats left, signup without an account, and a waitlist.            |
| `assets`             | An asset register with holders, check-outs, locations and lifecycle.          |
| `inventory`          | Products, stock per warehouse, orders and a reorder list.                     |
| `expenses`           | Expense claims with receipts, in-app approval and repayment.                  |
| `intranet`           | Must-read posts first, then news, people and resources.                       |
| `automation-recipes` | Automations that run in your own app, with every run kept.                    |
| `company-os`         | Pipeline, projects, tickets, team and time off over one client list.          |
| `app-starter`        | A business-app skeleton: every sign-in method, dashboards, settings, records. |

</details>

---

## CLI reference

`sovrium --help` prints all of this; `sovrium docs cli-api/cli` explains it in full.
A config path is optional wherever it is shown in brackets: Sovrium finds `app.yaml`,
`app.json` or `app.ts` in the current directory.

<details open>
<summary><strong>Run</strong></summary>

<br />

| Command                    | What it does                                                               | Key flags       |
| -------------------------- | -------------------------------------------------------------------------- | --------------- |
| `sovrium start [config]`   | Start the server (also the default: `sovrium app.yaml`)                    | `--watch`, `-w` |
| `sovrium dev [config]`     | Boot on fresh seed data with a dev account to sign in with, reload on save | `--no-open`     |
| `sovrium stop`             | Stop the running server                                                    |                 |
| `sovrium restart [config]` | Restart the running server                                                 |                 |
| `sovrium reload`           | Apply the edited config to the running server                              |                 |
| `sovrium build [config]`   | Build the pages as static files                                            |                 |

</details>

<details open>
<summary><strong>Project</strong></summary>

<br />

| Command                       | What it does                                                                                                                                                                    | Key flags                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `sovrium init [dir]`          | Scaffold a project, blank or from a template                                                                                                                                    | `--template <name\|owner/repo>`, `--typescript`, `--name`                                                    |
| `sovrium templates`           | List the templates `init` can scaffold, read out of the binary                                                                                                                  | `--json`                                                                                                     |
| `sovrium validate <config>`   | Validate a config without starting anything                                                                                                                                     | `--json`                                                                                                     |
| `sovrium schema`              | Print the JSON Schema every config is validated against                                                                                                                         | `--output <file>`                                                                                            |
| `sovrium types`               | Write `sovrium.d.ts` and `tsconfig.json` for an `app.ts`                                                                                                                        | `--output <dir>`                                                                                             |
| `sovrium seed [config]`       | Load `seed/<table>.yaml` data into the tables, here or on a hosted app                                                                                                          | `--mode if-empty\|upsert\|replace`, `--table`, `--dir`, `--dry-run`, `--app`                                 |
| `sovrium import <file\|dir>`  | Import tables, records, forms, pages and automations from another tool; `fetch` snapshots it first                                                                              | `--from <tool>`, `--write`, `--apply`, `--only`, `--prefix`                                                  |
| `sovrium migrate [config]`    | Bring the database schema forward without booting                                                                                                                               | `--dry-run`, `--check`, `--allow-destructive`                                                                |
| `sovrium library <verb>`      | `list`, `search`, `show` or `add` ready-made blocks, connections and recipes                                                                                                    | `--kind`, `--set key=value`, `--into`, `--as`                                                                |
| `sovrium render <asset>`      | Render a template asset (email, document) offline with sample data                                                                                                              |                                                                                                              |
| `sovrium design-system`       | Export the design system as an agent brief, DTCG JSON or a portable bundle, with the app's pages drawn in it; `import` maps a design tool's tokens, or its reworked pages, back | `--format md\|json\|bundle`, `--pages`, `--seed`, `--prototype`, `--mode light\|dark`, `--output`, `--force` |
| `sovrium bundle [config]`     | Package the validated config, the markdown files its pages read, `public/` and `seed/` for deployment                                                                           | `--output`                                                                                                   |
| `sovrium docs [address]`      | Read the platform manual out of the binary, offline                                                                                                                             | `--full`, `--section`, `--list-sections`, `--format`                                                         |
| `sovrium changelog [version]` | Read the release notes this binary carries                                                                                                                                      | `--list`, `--since <version>`                                                                                |
| `sovrium skills`              | Write this version's Agent Skills into `.claude/skills/`                                                                                                                        | `--target claude\|agents\|all`, `--check`, `--force`                                                         |
| `sovrium mcp`                 | Serve the config tools to a local AI client over stdio                                                                                                                          | `--project <dir>`                                                                                            |
| `sovrium report`              | Print a prefilled issue address for a bug, an idea or a server error; nothing is sent                                                                                           | `--last-error`, `--request-id <id>`, `--feature <kind>`, `--open`                                            |
| `sovrium licenses`            | Print the third-party license notices this binary carries                                                                                                                       | `--format`                                                                                                   |

</details>

<details open>
<summary><strong>Operate</strong></summary>

<br />

| Command                        | What it does                                                                                   | Key flags                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `sovrium admin create <email>` | Create an admin account                                                                        | `--name`, `--password` (else prompted)               |
| `sovrium secret generate`      | Print fresh secrets as `.env` lines                                                            |                                                      |
| `sovrium secret adopt`         | Persist `$SOVRIUM_ENCRYPTION_KEY` to the data directory                                        |                                                      |
| `sovrium backup [config]`      | Write the database, key, config and uploads to one archive                                     | `--output`                                           |
| `sovrium restore <file>`       | Put a backup back (never over a running server)                                                | `--data-dir`, `--force`                              |
| `sovrium usage [config]`       | Print how many bytes the database and the stored files hold                                    | `--json`, `--report <file>`                          |
| `sovrium update`               | Update to the latest version                                                                   |                                                      |
| `sovrium login`                | Sign the CLI in to a Sovrium Cloud                                                             | `--host`, `--api-key`, `--status`                    |
| `sovrium deploy [config]`      | Ship the app to your Sovrium Cloud and follow it until live                                    | `--app`, `--from-preview <id>`, `--no-wait`, `--yes` |
| `sovrium preview [config]`     | Run the app on your Sovrium Cloud at a share address of its own, without touching the live app | `--app`, `--no-wait`, `--yes`                        |
| `sovrium env <verb>`           | Set, list or remove the variables of a hosted app                                              | `--app`                                              |

</details>

**Environment.** Every variable is optional; Sovrium runs with none. The ones you meet
first: `PORT` (default `3000`), `BASE_URL`, `DATABASE_URL` (PostgreSQL; omit for
SQLite), `AI_PROVIDER`, `STORAGE_PROVIDER`, `SOVRIUM_ENCRYPTION_KEY`. The full list is in
[`.env.example`](.env.example) and [Environment variables](https://sovrium.com/en/docs/env-vars).

---

## Configuration

A config is one object, written in the format you prefer:

- **YAML or JSON**, split across as many files as you like with `$ref`.
- **TypeScript**: run `sovrium types` and the binary writes the types it accepts next to
  your config, so your editor completes and checks it. No `package.json`, no
  `node_modules`, no install:

  ```ts
  // app.ts
  import type { AppConfig } from 'sovrium'

  export default { name: 'my-app' } satisfies AppConfig
  ```

- **In your editor**: point it at the published JSON Schema,
  `https://sovrium.com/schema/app.json`, or print the one your binary accepts with
  `sovrium schema`.

The root keys are `name`, `tables`, `auth`, `pages`, `forms`, `automations`, `agents`,
`connections`, `buckets`, `design`, `languages`, `analytics`, `redirects`, `links`,
`assets`, `env` and a few more; [Schema overview](https://sovrium.com/en/docs/schema-overview)
describes each.

---

## Built for AI agents

Sovrium is written to be read and edited by a coding agent as easily as by a person.

| What                    | How                                                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The exact schema        | `sovrium schema` prints the JSON Schema of the binary you run; `sovrium types` writes its TypeScript declaration.                                                                                                                      |
| The manual, offline     | `sovrium docs <section>/<slug>` reads one article, `sovrium docs search <query>` finds one, `sovrium docs config tables[].fields[].type` looks an option up.                                                                           |
| Fast feedback           | `sovrium validate --json` returns every problem with its path and its fix.                                                                                                                                                             |
| Agent Skills            | `sovrium skills --target all` writes skills matching your Sovrium version for Claude Code and other agents, and refreshes them after an upgrade.                                                                                       |
| Your config over MCP    | `sovrium mcp --project <dir>` lets the AI client you already use read your config, its findings, its schema and its run state over stdio, with no server and no credentials. Writing tools stay off unless you set `MCP_CONFIG_WRITE`. |
| Your app over MCP       | With `MCP_ENABLED`, the running app serves its tables, automations and actions as MCP tools to authenticated clients.                                                                                                                  |
| Docs for LLMs           | [`sovrium.com/llms.txt`](https://sovrium.com/llms.txt) is the documentation entry point for an agent; an app can serve its own `/llms.txt`.                                                                                            |
| Your design, as a brief | `sovrium design-system app.ts --output DESIGN.md` describes your design system to an agent.                                                                                                                                            |

The edits always land in the config file, and the ordinary watcher applies them. There is
no editing endpoint over HTTP.

---

## Deploy

The same config runs everywhere the binary or the container runs:

| Target                         | Guide                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Docker                         | [Deploy with Docker](https://sovrium.com/en/docs/deploy-docker)                                  |
| Docker Compose with PostgreSQL | [Docker Compose and PostgreSQL](https://sovrium.com/en/docs/deploy-docker-compose-postgres)      |
| A VPS with systemd and Caddy   | [systemd and Caddy](https://sovrium.com/en/docs/deploy-vps-systemd-caddy)                        |
| Scalingo                       | [Deploy on Scalingo](https://sovrium.com/en/docs/deploy-scalingo)                                |
| Any host running a container   | point it at `ghcr.io/sovrium/sovrium` ([Installation](https://sovrium.com/en/docs/installation)) |
| Sovrium Cloud                  | `sovrium login`, then `sovrium deploy` ([CLI reference](https://sovrium.com/en/docs/cli))        |

Before going live, read [Security hardening](https://sovrium.com/en/docs/security-hardening)
and set a public `https://` `BASE_URL`.

---

## Where Sovrium fits

Sovrium covers, from one config, the jobs teams usually spread across separate tools.

| If you would otherwise reach for…        | In Sovrium                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| A spreadsheet-database                   | `tables` with typed fields, views, permissions and a REST API              |
| An internal-tool or back-office builder  | `pages` built from data-bound components, behind roles                     |
| A form builder                           | `forms`, delivered to a table, an email or an automation                   |
| A workflow automation service            | `automations` with triggers, connected services, approvals and run history |
| A backend-as-a-service or a headless CMS | `auth`, the records API, OpenAPI, `buckets` and live refresh               |
| A documentation-site generator           | markdown collections, or the `docs-site` template                          |
| An admin panel                           | `/_admin`, included                                                        |

Moving data in: [Migrate from Airtable](https://sovrium.com/en/docs/migrate-from-airtable)
and [Migrate from Zapier](https://sovrium.com/en/docs/migrate-from-zapier).

What stays the same whatever you build: the app is a file in your Git, the code is
source-available, and it runs on your own machine or server as one binary or one
container.

---

## Free and paid

<!-- O-013 O-014 (Sovrium Cloud) · O-004 to O-012 (Sovrium Partner) -->

The Sovrium engine, the desktop app and local AI editing with your own key are free; Sovrium Cloud sells managed hosting, collaborative and managed-AI editing — the hosted config-editing plane — because the line is whose compute runs it, and the self-hosted product never ships a visual or AI config editor.

| Free, self-hosted                                  | Paid services around the engine                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| The engine, with every feature: no edition, no key | **Sovrium Cloud**: managed hosting, collaborative and managed-AI editing                          |
| The desktop app                                    | **Sovrium Partner**: designs, with your team, the internal tool that serves it, from how you work |
| Local AI editing with your own provider and key    |                                                                                                   |

---

## How this is built and tested

**This repository is a filtered mirror of a private development monorepo.** The test
suite, CI workflows, lint configuration and internal tooling are excluded by an
allowlist in the release pipeline, so you will not find them here. They exist:
more than 1,250 Playwright spec files holding more than 15,000 end-to-end tests,
traced to more than 1,250 user stories, plus co-located unit tests for the domain
model and the tooling. A small number of specs are still tracked `test.fixme()` placeholders.

Every acceptance criterion is one `@spec` test carrying the ID of the user story it
satisfies, and each spec file also has one `@regression` test that replays those
criteria as a single continuous workflow. CI runs the regression tier and a packaging
tier against the compiled binary.

There is deliberately **no published code-coverage percentage**, because none is
measured: the gate is a test-file presence invariant, not a line threshold.

[How Sovrium Is Built](https://sovrium.com/en/docs/how-sovrium-is-built) covers all of
this in full, along with why the development infrastructure is private, the security
posture (including the absence of any third-party penetration test), and what happens to
your instance if the company stops.

---

## Documentation

The full documentation lives at [sovrium.com/docs](https://sovrium.com/docs), and the
same manual ships inside the binary (`sovrium docs`).

| Topic                         | Link                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Quick start                   | [sovrium.com/en/docs/quick-start](https://sovrium.com/en/docs/quick-start)                           |
| Concepts                      | [sovrium.com/en/docs/concepts](https://sovrium.com/en/docs/concepts)                                 |
| CLI reference                 | [sovrium.com/en/docs/cli](https://sovrium.com/en/docs/cli)                                           |
| Configuration and schema      | [sovrium.com/en/docs/schema-overview](https://sovrium.com/en/docs/schema-overview)                   |
| TypeScript configs            | [sovrium.com/en/docs/configuration-typescript](https://sovrium.com/en/docs/configuration-typescript) |
| Field types                   | [sovrium.com/en/docs/field-types-overview](https://sovrium.com/en/docs/field-types-overview)         |
| Automations                   | [sovrium.com/en/docs/automations-overview](https://sovrium.com/en/docs/automations-overview)         |
| AI and agents                 | [sovrium.com/en/docs/ai-overview](https://sovrium.com/en/docs/ai-overview)                           |
| Admin console                 | [sovrium.com/en/docs/admin-dashboard](https://sovrium.com/en/docs/admin-dashboard)                   |
| Environment variables         | [sovrium.com/en/docs/env-vars](https://sovrium.com/en/docs/env-vars)                                 |
| Bootstrapping the first admin | [sovrium.com/en/docs/cli-admin](https://sovrium.com/en/docs/cli-admin)                               |
| Installation                  | [sovrium.com/en/docs/installation](https://sovrium.com/en/docs/installation)                         |
| Security hardening            | [sovrium.com/en/docs/security-hardening](https://sovrium.com/en/docs/security-hardening)             |
| Templates and examples        | [sovrium.com/en/docs/templates-examples](https://sovrium.com/en/docs/templates-examples)             |

Runnable example configs ship in [`src/templates/`](src/templates/); `sovrium templates` lists them.

<details>
<summary><strong>Built with</strong></summary>

<br />

[Bun](https://bun.sh) · [Hono](https://hono.dev) · [Drizzle ORM](https://orm.drizzle.team) ·
[Effect](https://effect.website) · [Better Auth](https://better-auth.com) ·
[React 19](https://react.dev) · [Base UI](https://base-ui.com) ·
[shadcn/ui](https://ui.shadcn.com) · [Tailwind CSS 4](https://tailwindcss.com) ·
[TanStack](https://tanstack.com) · [Tauri](https://tauri.app) (desktop app)

</details>

---

## Status

Sovrium is a **feature-complete MVP** under active production hardening. Every domain
listed above is implemented; a small number of specs, scattered across domains, are
still tracked `test.fixme()` placeholders.

"Implemented" means the behaviour is built and locked by a spec. That is a distinct bar
from long-term production hardening, which continues as the platform matures. Release
notes are in [CHANGELOG.md](CHANGELOG.md), and `sovrium changelog --since <version>`
prints what changed since your upgrade.

---

## Contributing

Sovrium is developed and maintained by the core team. The most valuable way to help is
to tell us what you need:

- **Found a bug?** Run `sovrium report` (or `sovrium report --last-error` after a failed command): it prints a prefilled [issue](https://github.com/sovrium/sovrium/issues/new) address with your version and platform, and sends nothing. Add clear steps to reproduce.
- **Want a feature?** [Open an issue](https://github.com/sovrium/sovrium/issues/new) describing the use case it solves.

Every issue is read and triaged.

This repository is a filtered mirror of a private development monorepo, so a pull
request here cannot run the test suite or the CI pipeline that gate a change.
[How Sovrium Is Built](https://sovrium.com/en/docs/how-sovrium-is-built) explains what
that means for contributions.

Opening issues is open to everyone. **Submitting code requires becoming a certified
contributor**: write to **contribute@sovrium.com** to get started. This keeps the
contributor community small and reviewed. [CONTRIBUTING.md](CONTRIBUTING.md) has the
full process.

---

## Security

To report a vulnerability, follow [SECURITY.md](SECURITY.md), which also states the
continuity commitment. Do not open a public issue for a security report.

---

## License

Sovrium is source-available under the [Business Source License 1.1](LICENSE.md): free
for internal and non-commercial use; it prevents offering Sovrium as a competing hosted
service. Commercial hosting licenses: license@sovrium.com.

The name and logo are covered by the [trademark policy](TRADEMARK.md).

---

<p align="center">
  <sub>&copy; 2025–2026 ESSENTIAL SERVICES &middot; Sovrium is a trademark of ESSENTIAL SERVICES.</sub>
</p>
