<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://sovrium.com/logos/sovrium-icon-light.svg" />
    <img src="https://sovrium.com/logos/sovrium-icon-dark.svg" alt="Sovrium" width="88" height="88" />
  </picture>
</p>

<h1 align="center">Sovrium</h1>

<h3 align="center">One Config. Complete App. Full Control.</h3>

<p align="center">
  The source-available alternative to Airtable, Retool, and Notion.<br />
  Self-hosted. Configuration-driven. No vendor lock-in.
</p>

<p align="center">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun_1.4-f472b6" alt="Bun" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6.0-3178c6" alt="TypeScript" /></a>
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
- [How this is built and tested](#how-this-is-built-and-tested)
- [Documentation](#documentation)
- [Architecture](#architecture)
- [Status](#status)
- [Contributing](#contributing)
- [Community & support](#community--support)
- [License](#license)

---

## What is Sovrium?

Sovrium turns a **single configuration file** into a complete, running web
application: database, REST API, authentication, and pages included.

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
home page, with zero lines of application code.

Configs can also be written in JSON or TypeScript. For TypeScript, run
`sovrium types` and the binary writes the types it accepts next to your config —
no `package.json`, no `node_modules`, no install:

```ts
// app.ts
import type { AppConfig } from 'sovrium'

export default { name: 'my-app' } satisfies AppConfig
```

You get editor autocompletion and compile-time checking, against the schema of
the binary you actually run. See
[Authoring with TypeScript](https://sovrium.com/en/docs/configuration-typescript).

---

## Why Sovrium?

A typical organization can pay **$10k+/month** for 20+ SaaS tools: a database
here, an internal-tools builder there, a CMS, an auth provider, with data
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
content sites, and APIs, driven by configuration.

**Sovrium is not** a code framework you build on. You write configuration, not
application code.

Sovrium runs on your own machine or server. Sovrium Cloud is the optional
managed hosting for teams that would rather not run it themselves.

What it covers: table field types for text, numbers, dates, selections,
relations, media, users and AI, a Records REST API and matching UI,
authentication and RBAC, pages and a full component library, forms, theming,
internationalization, automations, AI fields and agents, analytics, file
buckets, and an operational admin console. The
[feature documentation](https://sovrium.com/docs) has the detail.

---

## Quick start

**Prerequisites:** none for an all-in-one trial. Sovrium defaults to embedded
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

> The `sovrium` npm package is **deprecated** — Sovrium ships as a binary, and
> nothing is published to npm any more. Authoring a TypeScript config needs no
> package either: `sovrium types` writes the declaration out of the binary.

### 2. Scaffold, validate, run

```bash
sovrium init --template crm --output ./my-app
cd my-app

sovrium validate app.yaml
# → Valid configuration: kestrel-crm

sovrium start app.yaml --watch
# → http://localhost:3000   (--watch hot-reloads on config changes)
```

`sovrium init` with no `--template` scaffolds a blank starter instead, and
`sovrium init ./my-app --typescript` makes that starter a typed `app.ts` with the
declaration and `tsconfig.json` already written. (`--typescript` cannot be
combined with `--template`: a template ships its own config.)

`sovrium build app.yaml` exports a static site to `./dist` for content sites
that need no server.

A fresh instance has no admin user. Pick one of the three bootstrap paths in
[Admin & Maintenance](https://sovrium.com/en/docs/cli-admin).

---

## How this is built and tested

**This repository is a filtered mirror of a private development monorepo.** The
test suite, CI workflows, lint configuration, and internal tooling are excluded
by an allowlist in the release pipeline, so you will not find them here. They
exist: more than 1,000 Playwright spec files holding more than 11,000 end-to-end
tests, traced to more than 1,000 user stories, plus co-located unit tests for
the domain model and the tooling. A small number of specs are still tracked
`test.fixme()` placeholders.

Every acceptance criterion is one `@spec` test carrying the ID of the user story
it satisfies, and each spec file also has one `@regression` test that replays
those criteria as a single continuous workflow. CI runs the regression tier plus
a packaging tier against the compiled binary on every push and pull request,
gated behind lint and type-check.

There is deliberately **no published code-coverage percentage**, because none is
measured: the gate is a test-file presence invariant, not a line threshold.

[**How Sovrium Is Built**](https://sovrium.com/en/docs/how-sovrium-is-built)
covers all of this in full, along with why the development infrastructure is
private, the security posture (including the absence of any third-party
penetration test), and what happens to your instance if the company stops.

---

## Documentation

Full documentation lives at [sovrium.com/docs](https://sovrium.com/docs), in
English and French.

| Topic                         | Link                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| CLI command reference         | [sovrium.com/en/docs/cli](https://sovrium.com/en/docs/cli)                               |
| Configuration and schema      | [sovrium.com/en/docs/schema-overview](https://sovrium.com/en/docs/schema-overview)       |
| Environment variables         | [sovrium.com/en/docs/env-vars](https://sovrium.com/en/docs/env-vars)                     |
| Bootstrapping the first admin | [sovrium.com/en/docs/cli-admin](https://sovrium.com/en/docs/cli-admin)                   |
| Deployment                    | [sovrium.com/en/docs/installation](https://sovrium.com/en/docs/installation)             |
| Security hardening            | [sovrium.com/en/docs/security-hardening](https://sovrium.com/en/docs/security-hardening) |
| Templates and examples        | [sovrium.com/en/docs/templates-examples](https://sovrium.com/en/docs/templates-examples) |

Runnable example configs ship in [`templates/`](templates/). `sovrium schema`
prints the canonical JSON Schema, and
[`sovrium.com/llms.txt`](https://sovrium.com/llms.txt) is an LLM-optimized
documentation entry point for driving Sovrium with a coding agent.

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

## Status

Sovrium is a **feature-complete MVP** under active production hardening. Every
domain listed above is implemented; a small number of specs, scattered across
domains, are still tracked `test.fixme()` placeholders.

"Implemented" means the behavior is built and locked by a spec. That is a
distinct bar from long-term production hardening, which continues as the
platform matures. See
[How Sovrium Is Built](https://sovrium.com/en/docs/how-sovrium-is-built) for how
the suite is organised and gated.

---

## Contributing

Sovrium is developed and maintained by the core team. The most valuable way to
help is to tell us what you need:

- **Found a bug?** [Open an issue](https://github.com/sovrium/sovrium/issues/new) with clear steps to reproduce.
- **Want a feature?** [Open an issue](https://github.com/sovrium/sovrium/issues/new) describing the use case it solves.

Every issue is read and triaged.

Note that this repository is a filtered mirror of a private development
monorepo, so a pull request here cannot run the test suite or the CI pipeline
that gate a change. [How Sovrium Is Built](https://sovrium.com/en/docs/how-sovrium-is-built)
explains what that means for contributions.

Opening issues is open to everyone. **Submitting code requires becoming a
certified contributor.** Contact **contribute@sovrium.com** to get started. This
keeps us from being overwhelmed by AI-generated pull requests and guarantees a
high-quality contributor community. See [CONTRIBUTING.md](CONTRIBUTING.md) for
the full process.

---

## Community & support

- [Documentation](https://sovrium.com/docs) — guides and reference
- [Security policy](SECURITY.md) — how to report a vulnerability, and the continuity commitment
- [sovrium.com](https://sovrium.com) — product overview and where Sovrium is headed

For bug reports and feature requests, see [Contributing](#contributing) above.

---

## License

Sovrium is source-available under the
[Business Source License 1.1](LICENSE.md): free for internal and non-commercial
use; it prevents offering Sovrium as a competing hosted service. Commercial
hosting licenses: license@sovrium.com.

The Sovrium engine, the desktop app and local AI editing with your own key are free; Sovrium Cloud sells managed hosting, collaborative and managed-AI editing — the hosted config-editing plane — because the line is whose compute runs it, and the self-hosted product never ships a visual or AI config editor.

**Sovrium Partner** (implementation & migration) and **Sovrium Academy**
(training) are the other paid services around the engine, never sovereignty
itself.

---

<p align="center">
  <strong>One Config. Complete App. Full Control.</strong>
</p>

<p align="center">
  <sub>&copy; 2025–2026 ESSENTIAL SERVICES &middot; Sovrium is a trademark of ESSENTIAL SERVICES.</sub>
</p>
