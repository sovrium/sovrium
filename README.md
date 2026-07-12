<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://sovrium.com/logos/sovrium-icon-light.svg" />
    <img src="https://sovrium.com/logos/sovrium-icon-dark.svg" alt="Sovrium" width="88" height="88" />
  </picture>
</p>

<h1 align="center">Sovrium</h1>

<h3 align="center">One Config. Complete App. Full Control.</h3>

<p align="center">
  The open-source alternative to Airtable, Retool, and Notion.<br />
  Self-hosted. Configuration-driven. No vendor lock-in.
</p>

<p align="center">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun_1.3-f472b6" alt="Bun" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6.0-3178c6" alt="TypeScript" /></a>
  <a href="https://www.npmjs.com/package/@sovrium/types"><img src="https://img.shields.io/npm/v/@sovrium/types?label=%40sovrium%2Ftypes" alt="@sovrium/types on npm" /></a>
</p>

<p align="center">
  <a href="https://sovrium.com">Website</a> &middot;
  <a href="https://sovrium.com/docs">Docs</a> &middot;
  <a href="https://github.com/sovrium/sovrium/issues">Issues</a>
</p>

<!-- TODO: Add a product screenshot or demo GIF here (recommended: 1200x800px). -->

---

## Table of contents

- [What is Sovrium?](#what-is-sovrium)
- [Why Sovrium?](#why-sovrium)
- [Quick start](#quick-start)
- [Features](#features)
- [CLI command reference](#cli-command-reference)
- [Configuration](#configuration)
- [Environment variables](#environment-variables)
- [Bootstrapping the first admin](#bootstrapping-the-first-admin)
- [Deployment](#deployment)
- [Example: a headless API](#example-a-headless-api)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Status](#status)
- [Community & support](#community--support)
- [License](#license)

---

## What is Sovrium?

Sovrium turns a **single configuration file** into a complete, running web
application — PostgreSQL database, REST API, authentication, and pages included.

No code generation. No external services. No SaaS subscription. You describe
**what** your app contains; Sovrium builds and runs it.

```yaml
# my-crm.yaml
name: my-crm
description: A tiny CRM, defined entirely in config

# Define a table — Sovrium creates the database table AND a REST API for it.
tables:
  - id: 1
    name: contacts
    fields:
      - id: 1
        name: name
        type: single-line-text
        required: true
      - id: 2
        name: email
        type: email
      - id: 3
        name: status
        type: single-select
        options:
          - Lead
          - Active
          - Inactive

# Turn on email + password authentication.
auth:
  strategies:
    - type: emailAndPassword

# Build a page from components.
pages:
  - name: home
    path: /
    meta:
      title: My CRM
    components:
      - type: text
        element: h1
        content: Welcome to My CRM
```

```bash
sovrium start my-crm.yaml
# → http://localhost:3000
```

That config gives you a `contacts` table with a full REST API
(`/api/tables/contacts/records`), an email/password sign-in flow, and a
home page — with zero lines of application code.

<details>
<summary><strong>Prefer TypeScript?</strong> Use it for autocompletion and compile-time validation.</summary>

<br />

Install the type package as a dev dependency, then wrap your config in
`defineConfig` for full IDE autocompletion:

```bash
bun add -d @sovrium/types   # or: npm install --save-dev @sovrium/types
```

```typescript
// my-crm.config.ts
import { defineConfig } from '@sovrium/types'

export default defineConfig({
  name: 'my-crm',
  description: 'A tiny CRM, defined entirely in config',
  tables: [
    {
      id: 1,
      name: 'contacts',
      fields: [
        { id: 1, name: 'name', type: 'single-line-text', required: true },
        { id: 2, name: 'email', type: 'email' },
        { id: 3, name: 'status', type: 'single-select', options: ['Lead', 'Active', 'Inactive'] },
      ],
    },
  ],
  auth: { strategies: [{ type: 'emailAndPassword' }] },
  pages: [
    {
      name: 'home',
      path: '/',
      meta: { title: 'My CRM' },
      components: [{ type: 'text', element: 'h1', content: 'Welcome to My CRM' }],
    },
  ],
})
```

```bash
sovrium start my-crm.config.ts
# → http://localhost:3000
```

TypeScript configs are type-checked at startup — schema mistakes surface as
compile errors instead of runtime failures.

</details>

---

## Why Sovrium?

A typical organization can pay **$10k+/month** for 20+ SaaS tools — a database
here, an internal-tools builder there, a CMS, an auth provider — with data
scattered across vendor clouds and zero control over any of it.

Sovrium is **one self-hosted platform** that covers those needs, configured in
files **you own** and **version in Git**.

|                     |                Sovrium                 | SaaS tools (Airtable / Retool / Notion) |
| ------------------- | :------------------------------------: | :-------------------------------------: |
| **Data ownership**  |              Your servers              |              Vendor cloud               |
| **Monthly cost**    |          Infrastructure only           |          $20–50 per user/month          |
| **Vendor lock-in**  |                  None                  |                  High                   |
| **Customization**   |               Extensive                |           Limited to features           |
| **Version control** |  Git-native (the config _is_ the app)  |                  None                   |
| **Hosting**         | Anywhere you run a binary or container |               Vendor-only               |

**Sovrium is** a self-hosted platform for internal tools, CRMs, admin panels,
content sites, and APIs — driven by configuration.

**Sovrium is not** a SaaS product, a hosted service, or a code framework you
build on. You write configuration, not application code.

---

## Quick start

**Prerequisites:** none for an all-in-one trial — Sovrium defaults to embedded
SQLite and local file storage. For production, point `DATABASE_URL` at
PostgreSQL 15+.

### 1. Install

The standalone binary requires neither Node nor Bun:

```bash
# macOS / Linux — install script
curl -fsSL https://sovrium.com/install | sh

# Homebrew (macOS / Linux)
brew install sovrium/tap/sovrium

# Scoop (Windows)
scoop bucket add sovrium https://github.com/sovrium/scoop-bucket
scoop install sovrium

# Docker
docker pull ghcr.io/sovrium/sovrium:latest
```

> Already installed? `sovrium update` keeps you current regardless of how you
> installed: it self-replaces a raw binary, or delegates to `brew upgrade` /
> `scoop update` for package-manager installs.

> The `sovrium` npm package is **deprecated** — Sovrium ships as a binary.
> Only [`@sovrium/types`](https://www.npmjs.com/package/@sovrium/types) is
> published to npm: install it as a dev dependency for `defineConfig`
> autocompletion when authoring TypeScript configs.

### 2. Scaffold a project

```bash
sovrium init --template crud --output ./my-app
cd my-app
```

### 3. Validate your config

```bash
sovrium validate app.yaml
# → Valid configuration: my-app
```

### 4. Run it

```bash
sovrium start app.yaml --watch
# → http://localhost:3000   (--watch hot-reloads on config changes)
```

### 5. Ship a static build (optional)

```bash
sovrium build app.yaml
# → ./dist  (static HTML/CSS/JS — host anywhere)
```

---

## Features

Sovrium covers the building blocks of a business application. Each domain is
declared in the same configuration file.

Legend: ✅ implemented &nbsp;·&nbsp; 🔭 planned.

### Data & API

| Status | Domain          | What you get                                                                                                                                                                  |
| :----: | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Tables**      | **49 field types** across 9 families — text, numeric, date/time, selection, special, system, attachment, advanced (formulas, lookups, rollups, relationships), and AI fields. |
|   ✅   | **Views**       | Saved table views with filtering, sorting, grouping, and per-role permissions. SQL views and JSON-config views.                                                               |
|   ✅   | **Records API** | Every table gets a CRUD REST API with filtering, sorting, pagination, batch ops, upsert, soft-delete, authorship, and change history.                                         |
|   ✅   | **Records UI**  | Data tables, forms, kanban boards, calendars, and galleries bound directly to your tables — plus runtime views, CSV import/export, and undo/redo.                             |
|   ✅   | **Migrations**  | Schema evolution with checksum validation and a startup conflict check (Git-like fast-forward / conflict detection).                                                          |

### Authentication & access

| Status | Domain                | What you get                                                                                                                                                |
| :----: | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Authentication**    | Email/password, magic links, password recovery, two-factor (TOTP), and session management — plus OAuth 2.1 / OIDC server mode and organization/team groups. |
|   ✅   | **RBAC**              | Role-based access control with built-in `admin` / `member` / `viewer` roles, plus table- and field-level permissions.                                       |
|   ✅   | **Account & GDPR**    | Self-service personal-data export (Art. 15/20) and scheduled account erasure with hard purge (Art. 17).                                                     |
|   ✅   | **Security baseline** | Security headers, CSRF / cross-origin guards, and anti-enumeration `404`s applied platform-wide.                                                            |

### Interface & content

| Status | Domain                   | What you get                                                                                                                                                                                                                                                            |
| :----: | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Pages**                | Page definitions, navigation, icons, CRUD components, auth components, interactivity, the full component library (charts, calendars, kanban, galleries, overlays), and SEO/meta primitives.                                                                             |
|   ✅   | **Forms**                | Top-level `app.forms[]` with standalone routes, multi-step / one-question layouts, conditional logic, file uploads, and prefill. 🔭 Planned submission extras: save-and-resume, edit-after-submit, calculation fields, payment fields, CAPTCHA, and a moderation queue. |
|   ✅   | **Theming**              | Colors, typography, spacing, shadows, radii, breakpoints, and animations — all defined in config.                                                                                                                                                                       |
|   ✅   | **Internationalization** | Built-in translations, browser language detection, RTL layout, and per-user language preference.                                                                                                                                                                        |

### Logic & intelligence

| Status | Domain          | What you get                                                                                                                                                                                                                            |
| :----: | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Automations** | Triggers (webhook, schedule, record, form, auth, automation-call) and 20+ action types (HTTP, email, code, AI, approvals, branching, loops).                                                                                            |
|   ✅   | **AI & agents** | AI computed fields, conversational chat over your data, RAG pipelines, AI agents, and MCP integration — all declarative, with `local-first` provider routing.                                                                           |
|   ✅   | **Analytics**   | Privacy-first, cookie-free page analytics — views, visitors, referrers, campaigns, and a unified events model.                                                                                                                          |
|   ✅   | **Admin Space** | A `/admin` operational **data** console — browse/manage record data, monitor automation runs, and review submissions, accounts, and analytics. Configuration (tables, pages, automations, theme) stays in code (files + Git), not here. |

### Storage & developer experience

| Status | Domain             | What you get                                                                                                                                         |
| :----: | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Buckets**        | Pluggable file storage — S3-compatible, local filesystem, or PostgreSQL bytea fallback. Signed URLs, image transforms, and bucket-level permissions. |
|   ✅   | **CLI**            | Run, build, validate, scaffold, and inspect — see the [command reference](#cli-command-reference) below.                                             |
|   ✅   | **Config formats** | YAML, JSON, or TypeScript — with `@sovrium/types` for autocompletion and startup type-checking.                                                      |

---

## CLI command reference

```bash
sovrium <command> [config] [options]
```

If you pass a config file with no command, `start` is assumed
(`sovrium app.yaml` ≡ `sovrium start app.yaml`).

| Command                       | Purpose                                                                                                                 | Common options                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `start [config]`              | Start the application server (default command).                                                                         | `--watch, -w`                             |
| `build [config]`              | Build a static site into `./dist`.                                                                                      | _(see build env vars)_                    |
| `validate [config]`           | Validate a config file against the Sovrium schema.                                                                      | —                                         |
| `schema`                      | Print the Sovrium JSON Schema to stdout.                                                                                | `--output <path>`                         |
| `init [dir]`                  | Scaffold a new project from a template.                                                                                 | `--template <t>`, `--name <n>`, `--force` |
| `agents list`                 | List available AI agent templates.                                                                                      | —                                         |
| `agents install <name>`       | Install an agent template into the project.                                                                             | `--force`                                 |
| `admin create <email>`        | Create an admin user against the active database (prompts for the password unless `--password` given).                  | `--password <value>`                      |
| `secret generate [target]`    | Print fresh, cryptographically random secrets as `.env`-shaped lines. Target: `auth`, `encryption`, or `all` (default). | —                                         |
| `update`                      | Update the Sovrium binary to the latest release.                                                                        | —                                         |
| `stop` / `restart` / `reload` | Control a running server (`reload` hot-swaps config without downtime).                                                  | —                                         |
| `--help, -h`                  | Show help.                                                                                                              | —                                         |
| `--version, -v`               | Show the installed version.                                                                                             | —                                         |

```bash
# Examples
sovrium start app.yaml --watch                  # dev server with hot reload
sovrium validate app.ts                         # type-check a TypeScript config
sovrium build app.json                          # static-site export
sovrium schema --output sovrium.schema.json     # write the JSON Schema to disk
sovrium init ./my-app --template blog           # scaffold a new project
sovrium admin create me@example.com             # provision an admin (prompts for password)
sovrium secret generate                         # print AUTH_SECRET + SOVRIUM_ENCRYPTION_KEY
```

Supported config formats: `.json`, `.yaml`, `.yml`, `.ts`.

---

## Configuration

A Sovrium app is one configuration file. Every top-level key is **optional** —
include only what your app needs:

- A **marketing site**? Just `pages`.
- A **headless API**? Just `tables` (+ `auth`).
- A **full app**? `tables` + `auth` + `pages` + `automations` + `theme` + …

### Where the config comes from

Sovrium resolves configuration in this order:

1. **File argument** — `sovrium start app.yaml`
2. **`APP_SCHEMA` environment variable** — inline JSON/YAML, or a remote URL:
   ```bash
   APP_SCHEMA='name: my-app' sovrium start
   APP_SCHEMA='https://example.com/app.yaml' sovrium start
   ```

### Authoring with TypeScript

The [`@sovrium/types`](https://www.npmjs.com/package/@sovrium/types) package is
a **zero-dependency** type definition published to npm. Its `defineConfig`
helper is an identity function that gives your editor full autocompletion and
type checking over the whole schema:

```typescript
import { defineConfig } from '@sovrium/types'

export default defineConfig({
  name: 'my-app',
  // ... fully autocompleted and type-checked ...
})
```

TypeScript configs are validated at server startup, so schema errors fail
fast with a clear message rather than misbehaving at runtime.

### Inspecting the schema

`sovrium schema` emits the canonical JSON Schema — useful for editor
integration, custom tooling, or feeding the contract to an AI agent.

### For AI agents & LLMs

Sovrium is built to be driven by an LLM or coding agent — the entire app surface
is a single, inspectable contract:

- **`sovrium schema`** — the canonical JSON Schema; hand it to an agent as the
  authoritative contract, or validate a generated config against it.
- **[`@sovrium/types`](https://www.npmjs.com/package/@sovrium/types)** — typed
  `defineConfig` authoring with full autocompletion and startup type-checking.
- **[`sovrium.com/llms.txt`](https://sovrium.com/llms.txt)** — an LLM-optimized
  documentation entry point.

---

## Environment variables

Sovrium follows a clear split: **infrastructure** concerns live in environment
variables (operator-controlled); **application** intent lives in the config
file (author-controlled). **Every variable is optional** — `sovrium start
app.yaml` runs zero-config with embedded SQLite, local file storage, AI
disabled, and eco-friendly defaults. The tables below cover every variable; an
annotated [`.env.example`](.env.example) ships the most common ones as
copy-paste defaults.

### Server & database

| Variable       | Default                                    | Purpose                                                                           |
| -------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `PORT`         | `3000`                                     | Server port.                                                                      |
| `BASE_URL`     | `http://localhost:<PORT>`                  | Public base URL of the app. Required for OAuth and cookie security in production. |
| `DATABASE_URL` | embedded SQLite (`./.sovrium/database.db`) | PostgreSQL connection string for production. Omit for zero-config SQLite.         |
| `LOG_LEVEL`    | `info`                                     | `debug` · `info` · `warn` · `error`.                                              |
| `NODE_ENV`     | —                                          | Set `production` to enable secure cookies and the CSRF / origin guard.            |

### Authentication & admin bootstrap

| Variable                                                       | Purpose                                                                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                                                  | Secret used to sign sessions and tokens. Minimum 16 chars; generate with `sovrium secret generate`. Strongly recommended in production. |
| `SOVRIUM_ENCRYPTION_KEY`                                       | Symmetric key used for encrypted columns (also produced by `sovrium secret generate`).                                                  |
| `AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD` / `AUTH_ADMIN_NAME` | Provision the first admin at startup. See [Bootstrapping the first admin](#bootstrapping-the-first-admin).                              |
| `<PROVIDER>_CLIENT_ID` / `_SECRET`                             | Social-login OAuth credentials, e.g. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.                                                       |

### Storage, AI & email

| Variable                                                                                                                        | Default     | Purpose                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_PROVIDER`                                                                                                              | auto        | `s3` · `local`. Omit for auto: local files when running on SQLite; PostgreSQL `bytea` fallback when running on PostgreSQL. |
| `STORAGE_S3_ENDPOINT` / `STORAGE_S3_BUCKET` / `STORAGE_S3_REGION` / `STORAGE_S3_ACCESS_KEY_ID` / `STORAGE_S3_SECRET_ACCESS_KEY` | —           | S3-compatible storage credentials (AWS S3, MinIO, Cloudflare R2, …).                                                       |
| `STORAGE_LOCAL_DIRECTORY`                                                                                                       | `./uploads` | Filesystem directory when `STORAGE_PROVIDER=local`.                                                                        |
| `AI_PROVIDER`                                                                                                                   | — (AI off)  | `ollama` · `openai` · `anthropic` · `mistral` · `google`. Set to enable AI features.                                       |
| `AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL`                                                                                       | —           | Credentials, model, and (for self-hosted endpoints) base URL. `AI_BASE_URL=http://localhost:11434` for Ollama.             |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`                                                                           | —           | Outbound email server. Email is disabled when `SMTP_HOST` is unset.                                                        |

### Eco-conception

Sovrium is fast and full-featured by default. The defaults below are win-win —
AVIF image transcoding and static-page caching cut bytes _and_ speed up
delivery, and local-first AI routing keeps inference on your own hardware.
Eco-conception's deeper, experience-affecting frugality (low-data mode,
data-retention purge) is a first-class **opt-in** posture you switch on when you
want it — never a paid tier, never a greenwashed badge. The table reflects the
current `ECO_*` defaults.

| Variable                     | Default       | Purpose                                                                         |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------- |
| `ECO_MODE`                   | `on`          | Master eco posture (`on` · `off` · `auto`).                                     |
| `ECO_IMAGE_FORMAT`           | `avif`        | Server-side image transcoding format (`avif` · `webp` · `jpeg` · `png`).        |
| `ECO_AI_PROVIDER_PRECEDENCE` | `local-first` | AI routing precedence (`local-first` · `cloud-first` · `local-only`).           |
| `ECO_PAGE_CACHE`             | `on`          | In-memory static-page HTML cache (skips re-render for request-invariant pages). |

> Static builds also accept `SOVRIUM_*` variables — `SOVRIUM_OUTPUT_DIR`,
> `SOVRIUM_BASE_URL`, `SOVRIUM_DEPLOYMENT`, `SOVRIUM_GENERATE_SITEMAP`, and
> more. Run `sovrium build --help` or see the [docs](https://sovrium.com/docs)
> for the full list.

---

## Bootstrapping the first admin

A fresh Sovrium instance starts with an empty user table. There is no
default admin — you choose how to provision the first one. Sovrium supports
**three** complementary paths; all of them produce the same result: a
verified user with `role: 'admin'`.

### Path 1 — Environment variables (recommended for orchestrated deploys)

Set these env vars on the first launch. Sovrium creates the admin at startup
and skips on every subsequent boot:

| Variable              | Required | Notes                                      |
| --------------------- | -------- | ------------------------------------------ |
| `AUTH_ADMIN_EMAIL`    | yes      | Must be a valid email format.              |
| `AUTH_ADMIN_PASSWORD` | yes      | Minimum **8** characters.                  |
| `AUTH_ADMIN_NAME`     | no       | Display name; defaults to `Administrator`. |

Example `.env`:

```bash
# Required (generate with: sovrium secret generate)
AUTH_SECRET=<64+ hex characters>
BASE_URL=https://app.example.com

# First-admin bootstrap (consumed on the first boot, idempotent thereafter)
AUTH_ADMIN_EMAIL=admin@example.com
AUTH_ADMIN_PASSWORD=AStrongPasswordYouTypeOnce
AUTH_ADMIN_NAME=Operator
```

**What happens on boot:**

- If the user table is empty → the admin is created (email pre-verified).
- If the email already exists → no-op (Sovrium logs and continues).
- If any other user already exists → no-op (the bootstrap window is closed;
  use `sovrium admin create` instead).
- Requires `app.auth` to be configured in the schema.

After the first successful boot, the env vars can be removed.

### Path 2 — One-time bootstrap token (zero-config no-credentials boot)

If `AUTH_ADMIN_EMAIL` is **not** set and the user table is empty, Sovrium
generates a 256-bit, single-use bootstrap token at startup and folds it into
the startup banner — printed **exactly once** to stdout:

```text
  Sovrium v0.10.0

  ⚠ No admin user — claim one within 1 hour with the token below

  ✓ Mode: production
  ✓ Database: SQLite (./.sovrium/database.db)
  ✓ Storage: Local (./uploads)
  ✓ Server ready in 84ms

  → https://app.example.com
  → First-admin token (POST /api/admin/bootstrap/claim):
    7c9f8b2a1d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90
```

Claim it within an hour with one HTTP call:

```bash
curl -X POST https://app.example.com/api/admin/bootstrap/claim \
  -H "Authorization: Bearer 7c9f8b2a...8f90" \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@example.com", "password": "AStrongPassword1!", "name": "Operator" }'
```

Properties:

- Only the **SHA-256 hash** is persisted; the plaintext never appears in
  logs, the database, or any retained output.
- The token expires after 1 hour and can be claimed **once**.
- Once any user exists, the route returns `404` and the token becomes
  unclaimable — even if it were leaked.

This is the path for one-shot binary launches: `sovrium start app.yaml`,
copy the token from the terminal, claim, done.

### Path 3 — Interactive CLI (`sovrium admin create`)

For existing instances or when you don't want credentials in env vars or
HTTP bodies:

```bash
sovrium admin create me@example.com
# → Admin password: ****  (echo disabled, prompted on the TTY)
# → Created admin user "me@example.com".
```

In CI / non-interactive shells, pass the password explicitly:

```bash
sovrium admin create me@example.com --password "$ADMIN_PASSWORD"
```

The command is idempotent — re-running for an existing email reports
"already exists" rather than failing.

### Security caveats

- **Never commit secrets to Git.** Use `sovrium secret generate` to mint a
  fresh `AUTH_SECRET` (and `SOVRIUM_ENCRYPTION_KEY`), then load them from a
  secrets manager, container orchestrator, or systemd `EnvironmentFile=`.
- `AUTH_SECRET` is the signing key for sessions and tokens — rotating it
  invalidates every existing session. It must be at least 16 random bytes
  (≥32 hex characters); generators produce 32 bytes / 64 hex characters.
- In production (`NODE_ENV=production`), `BASE_URL` must match the public
  origin: cookies are flagged `Secure` and the CSRF / origin guard rejects
  requests whose `Origin` doesn't match.
- The bootstrap-token path closes permanently the moment any user exists —
  it is **not** a recurring backdoor. To recover from a lost admin password,
  re-run the server with `AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD` set
  (existing users with that email are not modified, so you may need to
  delete the user first) or use `sovrium admin create` with a different
  email.

---

## Deployment

| Method                | Best for                                       | Command                                     |
| --------------------- | ---------------------------------------------- | ------------------------------------------- |
| **Standalone binary** | Most deployments — single self-contained file. | `sovrium start app.yaml`                    |
| **Docker**            | Container platforms and orchestration.         | `docker run ghcr.io/sovrium/sovrium:latest` |
| **Homebrew**          | macOS / Linux developer machines.              | `brew install sovrium/tap/sovrium`          |
| **Static export**     | Marketing sites and content — host anywhere.   | `sovrium build app.yaml` → `./dist`         |

For a zero-infrastructure trial, the default embedded SQLite + local file
storage means a single binary and one config file is all you need. For
production, set `DATABASE_URL` to PostgreSQL 15+ and configure storage and
auth secrets via the [environment variables](#environment-variables) above.

---

## Example: a headless API

Sovrium's modularity means you can ship a pure backend — tables and auth, no
pages. This config produces two related tables, each with a full REST API:

```yaml
name: task-api
description: Headless API for task management

auth:
  strategies:
    - type: emailAndPassword

tables:
  - id: 1
    name: projects
    fields:
      - id: 1
        name: name
        type: single-line-text
        required: true
      - id: 2
        name: status
        type: single-select
        options:
          - Planning
          - Active
          - Completed

  - id: 2
    name: tasks
    fields:
      - id: 1
        name: title
        type: single-line-text
        required: true
      - id: 2
        name: project
        type: relationship
        relatedTable: projects
        relationType: many-to-one
      - id: 3
        name: done
        type: checkbox
      - id: 4
        name: due_date
        type: date
```

```bash
sovrium start task-api.yaml
# REST API ready at /api/tables/projects/records and /api/tables/tasks/records
```

More runnable examples live in [`examples/`](examples/).

---

## Architecture

<details>
<summary><strong>Built with</strong></summary>

<br />

[Bun](https://bun.sh) · [Hono](https://hono.dev) ·
[Drizzle ORM](https://orm.drizzle.team) · [Effect](https://effect.website) ·
[React 19](https://react.dev) · [Base UI](https://base-ui.com) ·
[Tailwind CSS 4](https://tailwindcss.com) · [Better Auth](https://better-auth.com)

</details>

---

## Contributing

Sovrium is developed and maintained by the core team. The most valuable way to
help is to tell us what you need:

- **Found a bug?** [Open an issue](https://github.com/sovrium/sovrium/issues/new) with clear steps to reproduce.
- **Want a feature?** [Open an issue](https://github.com/sovrium/sovrium/issues/new) describing the use case it solves.

Every issue is read and triaged.

Opening issues is open to everyone. **Submitting code requires becoming a
certified contributor** — contact **contribute@sovrium.com** to get started. This
keeps us from being overwhelmed by AI-generated pull requests and guarantees a
high-quality contributor community. See [CONTRIBUTING.md](CONTRIBUTING.md) for
the full process.

---

## Status

Sovrium is a **feature-complete MVP**, under active production hardening. Every
domain above is implemented: tables and the 49-field-type system, the Records REST
API and Records UI, authentication (including OAuth 2.1 / OIDC server mode and
organization/team groups), RBAC, account & GDPR, the security baseline, pages
and the full component library, forms, theming and the design system,
internationalization, automations, AI computed fields, chat, agents, RAG, MCP
integration, analytics, the Admin Space, buckets, migrations, and the CLI. The
only outstanding work is a handful of forms-submission extras — save-and-resume,
edit-after-submit, calculation fields, payment fields, CAPTCHA, and a moderation
queue.

"Implemented" means the behavior is built and locked; it is a distinct bar from
long-term production hardening, which continues as the platform matures.

---

## Community & support

- [Documentation](https://sovrium.com/docs) — guides and reference
- [Security policy](SECURITY.md) — supported versions and how to report a vulnerability
- [sovrium.com](https://sovrium.com) — product overview and where Sovrium is headed

For bug reports and feature requests, see [Contributing](#contributing) above.

---

## License

[BSL-1.1](LICENSE.md) — free for internal and non-commercial use; prevents
offering Sovrium as a competing hosted service. Automatically converts to
**Apache 2.0** on **July 12, 2030**. A move to **full open source sooner** is
under active evaluation. Commercial hosting licenses: license@sovrium.com.

The **engine is free forever** in self-hosted mode (no license keys, no feature
gating). What's paid is the companionship around it — **Sovrium Cloud** (managed
hosting + a hosted visual/AI config editor), **Sovrium Partner** (implementation
& migration), and **Sovrium Academy** (training) — never sovereignty itself.

---

<p align="center">
  <strong>One Config. Complete App. Full Control.</strong>
</p>

<p align="center">
  <sub>&copy; 2025–2026 ESSENTIAL SERVICES &middot; Sovrium is a trademark of ESSENTIAL SERVICES.</sub>
</p>
