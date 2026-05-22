<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://sovrium.com/logos/sovrium-icon-light.svg" />
    <img src="https://sovrium.com/logos/sovrium-icon-dark.svg" alt="Sovrium" width="88" height="88" />
  </picture>
</p>

<h1 align="center">Sovrium</h1>

<h3 align="center">Build business apps with config. Own your data forever.</h3>

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

A typical organization pays **$10k+/month** for 20+ SaaS tools — a database
here, an internal-tools builder there, a CMS, an auth provider — with data
scattered across vendor clouds and zero control over any of it.

Sovrium is **one self-hosted platform** that covers those needs, configured in
files **you own** and **version in Git**.

|                     |                Sovrium                 | SaaS tools (Airtable / Retool / Notion) |
| ------------------- | :------------------------------------: | :-------------------------------------: |
| **Data ownership**  |              Your servers              |              Vendor cloud               |
| **Monthly cost**    |            $0 (infra only)             |          $20–50 per user/month          |
| **Vendor lock-in**  |                  None                  |                Complete                 |
| **Customization**   |               Unlimited                |           Limited to features           |
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

Legend: ✅ stable &nbsp;·&nbsp; 🚧 in progress &nbsp;·&nbsp; 🔭 planned.

### Data & API

| Status | Domain                 | What you get                                                                                                                                                                  |
| :----: | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Tables**             | **52 field types** across 9 families — text, numeric, date/time, selection, special, system, attachment, advanced (formulas, lookups, rollups, relationships), and AI fields. |
|   ✅   | **Views**              | Saved table views with filtering, sorting, grouping, and per-role permissions. SQL views and JSON-config views.                                                               |
|   ✅   | **Automatic REST API** | Every table gets a CRUD API — filter, sort, paginate, and track changes. No endpoint code to write.                                                                           |
|   🚧   | **Records UI**         | Data tables, forms, kanban boards, calendars, and galleries bound directly to your tables — plus runtime views, CSV import/export, and undo/redo.                             |
|   ✅   | **Migrations**         | Schema evolution with checksum validation and a startup conflict check (Git-like fast-forward / conflict detection).                                                          |

### Authentication & access

| Status | Domain                | What you get                                                                                                          |
| :----: | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Authentication**    | Email/password, magic links, two-factor (TOTP), and social login. OAuth 2.1 / OIDC server mode for external clients.  |
|   ✅   | **RBAC**              | Role-based access control with built-in `admin` / `member` / `viewer` roles, plus table- and field-level permissions. |
|   ✅   | **Account & GDPR**    | Self-service personal-data export (Art. 15/20) and scheduled account erasure with hard purge (Art. 17).               |
|   ✅   | **Security baseline** | Security headers, CSRF / cross-origin guards, and anti-enumeration `404`s applied platform-wide.                      |

### Interface & content

| Status | Domain                   | What you get                                                                                                          |
| :----: | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
|   🚧   | **Pages**                | Compose pages from a component library — containers, text, buttons, data tables, charts, kanban, calendars, and more. |
|   🚧   | **Forms**                | Standalone or embedded forms with validation, multi-step wizards, and submission pipelines.                           |
|   ✅   | **Theming**              | Colors, typography, spacing, shadows, radii, breakpoints, and animations — all defined in config.                     |
|   ✅   | **Internationalization** | Built-in translations, browser language detection, RTL layout, and per-user language preference.                      |

### Logic & intelligence

| Status | Domain            | What you get                                                                                                                                                  |
| :----: | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | **Automations**   | Triggers (webhook, schedule, record, form, auth) and 20+ action types (HTTP, email, code, AI, approvals, branching, loops).                                   |
|   🚧   | **AI & agents**   | AI computed fields, conversational chat over your data, RAG pipelines, AI agents, and MCP integration — all declarative, with `local-first` provider routing. |
|   ✅   | **Analytics**     | Privacy-first, cookie-free page analytics — views, visitors, referrers, campaigns, and a unified events model.                                                |
|   🚧   | **Notifications** | In-app inbox and email digests with per-user preferences and `@mention` delivery.                                                                             |
|   🔭   | **Admin Space**   | A `/admin` console for managing tables, pages, automations, users, and theme — a self-service "wp-admin" for your app.                                        |

### Storage & developer experience

| Status | Domain             | What you get                                                                                                  |
| :----: | ------------------ | ------------------------------------------------------------------------------------------------------------- |
|   🚧   | **Buckets**        | Pluggable file storage — S3-compatible, local filesystem, or PostgreSQL fallback. Signed URLs and transforms. |
|   ✅   | **CLI**            | Run, build, validate, scaffold, and inspect — see the [command reference](#cli-command-reference) below.      |
|   ✅   | **Config formats** | YAML, JSON, or TypeScript — with `@sovrium/types` for autocompletion and startup type-checking.               |

---

## CLI command reference

```bash
sovrium <command> [config] [options]
```

If you pass a config file with no command, `start` is assumed
(`sovrium app.yaml` ≡ `sovrium start app.yaml`).

| Command                       | Purpose                                            | Common options                                              |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| `start [config]`              | Start the application server (default command).    | `--watch, -w`                                               |
| `build [config]`              | Build a static site into `./dist`.                 | _(see build env vars)_                                      |
| `validate [config]`           | Validate a config file against the Sovrium schema. | —                                                           |
| `schema`                      | Print the Sovrium JSON Schema to stdout.           | `--output <path>`                                           |
| `init`                        | Scaffold a new project from a template.            | `--template <t>`, `--output <dir>`, `--name <n>`, `--force` |
| `agents list`                 | List available AI agent templates.                 | —                                                           |
| `agents install <name>`       | Install an agent template into the project.        | `--force`                                                   |
| `update`                      | Update the Sovrium binary to the latest release.   | —                                                           |
| `stop` / `restart` / `reload` | Control a running server.                          | —                                                           |
| `--help, -h`                  | Show help.                                         | —                                                           |
| `--version, -v`               | Show the installed version.                        | —                                                           |

```bash
# Examples
sovrium start app.yaml --watch                 # dev server with hot reload
sovrium validate app.ts                        # type-check a TypeScript config
sovrium build app.json                         # static-site export
sovrium schema --output sovrium.schema.json    # write the JSON Schema to disk
sovrium init --template blog --output ./blog   # scaffold a new project
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

---

## Environment variables

Sovrium follows a clear split: **infrastructure** concerns live in environment
variables (operator-controlled); **application** intent lives in the config
file (author-controlled). Common variables:

### Server & database

| Variable       | Default         | Purpose                                             |
| -------------- | --------------- | --------------------------------------------------- |
| `PORT`         | `3000`          | Server port.                                        |
| `HOSTNAME`     | `localhost`     | Server hostname.                                    |
| `DATABASE_URL` | embedded SQLite | PostgreSQL connection string for production.        |
| `LOG_LEVEL`    | `info`          | `debug` · `info` · `warn` · `error`.                |
| `NODE_ENV`     | —               | Set `production` to enable secure cookies and CSRF. |

### Authentication

| Variable                           | Purpose                                           |
| ---------------------------------- | ------------------------------------------------- |
| `AUTH_SECRET`                      | Secret used to sign sessions (required for auth). |
| `BASE_URL`                         | Public base URL of the app (required for OAuth).  |
| `<PROVIDER>_CLIENT_ID` / `_SECRET` | OAuth credentials, e.g. `GOOGLE_CLIENT_ID`.       |

### Storage, AI & email

| Variable                                              | Default  | Purpose                                                   |
| ----------------------------------------------------- | -------- | --------------------------------------------------------- |
| `STORAGE_PROVIDER`                                    | `local`  | `local` · `s3` (S3 options via `STORAGE_S3_*`).           |
| `AI_PROVIDER`                                         | `ollama` | `anthropic` · `openai` · `mistral` · `google` · `ollama`. |
| `AI_API_KEY` / `AI_MODEL`                             | —        | Credentials and model for cloud AI providers.             |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | —        | Outbound email server.                                    |

### Eco-conception

Sovrium treats environmental footprint as a platform property — every `ECO_*`
variable defaults to the eco-aligned setting; operators opt _out_, never in.

| Variable                     | Default       | Purpose                                      |
| ---------------------------- | ------------- | -------------------------------------------- |
| `ECO_MODE`                   | `on`          | Master toggle (`on` · `off` · `auto`).       |
| `ECO_IMAGE_FORMAT`           | `avif`        | Server-side image transcoding format.        |
| `ECO_AI_PROVIDER_PRECEDENCE` | `local-first` | AI routing precedence (favors local models). |

> Static builds also accept `SOVRIUM_*` variables — `SOVRIUM_OUTPUT_DIR`,
> `SOVRIUM_BASE_URL`, `SOVRIUM_DEPLOYMENT`, `SOVRIUM_GENERATE_SITEMAP`, and
> more. Run `sovrium build --help` or see the [docs](https://sovrium.com/docs)
> for the full list.

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

---

## Status

Sovrium is under **active development**. Core domains — tables, the automatic
REST API, authentication, RBAC, theming, internationalization, automations,
analytics, account & GDPR, the security baseline, and the CLI — are stable
today. Pages, forms, buckets, AI & agents, notifications, and the Admin Space
are progressing.

Every feature is backed by an extensive end-to-end test suite before it ships
— at the time of writing, 80% of ~6,300 specs are passing with a 93% quality
score (see [SPEC-PROGRESS.md](SPEC-PROGRESS.md) for the live report).

---

## Community & support

- [Issues](https://github.com/sovrium/sovrium/issues) — bug reports and feature requests
- [Documentation](https://sovrium.com/docs) — guides and reference
- [sovrium.com](https://sovrium.com) — product overview and where Sovrium is headed

---

## License

[BSL-1.1](LICENSE.md) — free for internal and non-commercial use; prevents
offering Sovrium as a competing hosted service. Automatically converts to
**Apache 2.0** on **May 22, 2030**. Commercial hosting licenses:
license@sovrium.com.

---

<p align="center">
  <strong>Own your data. Own your tools. Own your future.</strong>
</p>

<p align="center">
  <sub>&copy; 2025–2026 ESSENTIAL SERVICES &middot; Sovrium is a trademark of ESSENTIAL SERVICES.</sub>
</p>
