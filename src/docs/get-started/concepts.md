# Core Concepts

> The anatomy of a Sovrium app — the configuration object, its root sections, and the philosophy that turns one file into a full-stack application.

A Sovrium app is a single declarative **configuration object**. You describe _what_ your application is — its data, pages, forms, authentication, automations — and Sovrium turns that description into a running, full-stack web application. There is no boilerplate, no framework scaffolding, and no build pipeline to wire up.

This article explains the anatomy of that configuration object so the rest of the reference makes sense. **Schema Overview** documents each root property and its options.

## The configuration object

Everything starts from one root object. Only `name` is required; every other section is optional and layered on as your app grows.

```text
name           App identifier (required)
version        SemVer version
description    One-line description
badge          The "Built with Sovrium" badge — set false to remove it

tables         Data models
pages          Server-rendered pages
forms          Standalone forms that capture submissions
auth           Authentication, roles, RBAC
design         The design system (colours, type, spacing, voice, …)
languages      Multi-language support ($t: syntax)

automations    Event-driven workflows (triggers + actions)
actions        Reusable action templates ($ref)
connections    External-service credentials
agents         AI agents acting under an auth role
buckets        Named file-storage containers

components     Reusable UI templates ($ref, $variable)
palette        The command palette and what it searches
systemSources  Platform data a page can bind to without a table
analytics      Cookie-free, first-party analytics
env            Declared automation env vars ($env.NAME)

redirects      Permanent and temporary URL redirects
links          Short links served under /l/
llms           The published llms.txt
decisions      Architecture decision records this app declares
admin          The operator console
```

**Progressive complexity.** A valid app can be as small as `name: my-app`. Add sections only when you need them — there is no minimum viable scaffold to fight through first.

## The root sections

Each section has its own article, and the option tables there are expanded from the schema itself rather than transcribed:

- `name`, `version`, `description` — **App Metadata**.
- `tables` — data models and their field types: **Tables Overview**.
- `pages` — server-rendered pages built from a tree of component types, with SEO and i18n: **Pages Overview**.
- `forms` — standalone forms that capture submissions into a table or trigger an automation: **Forms Overview**.
- `auth` — authentication strategies, roles, RBAC, sessions and two-factor: **Auth Overview**.
- `languages` — multi-language support with `$t:` translation syntax and URL routing: **Languages**.
- `automations` and `actions` — a trigger fires, a sequence of actions runs: **Automations Overview** and **Reusable Actions**.
- `connections` — reusable credentials for external services: **Automations Overview**.
- `agents` — AI agents that act on behalf of an auth role within a constrained tool set: **AI Overview**.
- `buckets` — named storage containers with per-bucket file limits and permissions: **Buckets Overview**.
- `components` — reusable UI templates inserted into pages via `$ref` with `$variable` substitution: **Reusable Components**.
- `palette` — the command palette, and which tables and pages it searches: **Search Components**.
- `systemSources` — platform data a page can bind to without declaring a table: **System Sources**.
- `analytics` — first-party, cookie-free analytics: **Schema Overview**.
- `env` — environment variables declared for automations and referenced as `$env.NAME`: **Environment Variables**.
- `redirects` — permanent and temporary URL redirects, locale-aware: **URL Redirects**.
- `links` — short links served under `/l/`: **Short Links**.
- `llms` — the `llms.txt` the app publishes for AI clients: **Publish llms.txt**.
- `decisions` — architecture decision records the app declares and renders: **Decision Records**.
- `admin` — the operator console mounted at `/_admin`: **Admin Dashboard**.
- `badge` — the "Built with Sovrium" badge; removing it is one config line and free: **App Metadata**.

**Records are not a root section.** Records are the rows _inside_ your tables. They are created and queried at runtime through the REST and MCP APIs rather than declared in the config — see **Records Overview**.

## Configuration-driven philosophy

Sovrium inverts the usual relationship between code and configuration. Instead of writing application code that occasionally reads a config file, you write configuration that Sovrium executes directly.

- **Declare, don't implement.** You declare a relationship field; Sovrium creates the foreign key, the join queries and the linked-record UI. You declare an automation; Sovrium wires the trigger, runs the actions and records the run history.
- **One source of truth.** The same object drives the database schema, the REST API, the MCP server, the rendered pages and the admin dashboard. There is no second place where the shape of your data is restated.
- **Cross-section validation.** Sections are validated together, not in isolation. A record automation that references a missing table, an attachment field pointing at an undeclared bucket, or a permission naming an unknown role are all rejected before the server starts — see **Validation & Schema Generation**.
- **Self-hostable, no lock-in.** The config runs on your infrastructure against commodity storage — SQLite by default, PostgreSQL optional. Your data and your schema stay yours.

## The layer model

Internally, Sovrium follows a four-layer architecture. You never write code in these layers for a config-only app, but the model explains _why_ the schema is shaped the way it is.

- **Presentation** renders pages and serves the REST and MCP APIs. Your config touches it through `pages`, `forms`, `components` and `design`.
- **Application** orchestrates workflows and use-cases: `automations`, `actions`, `agents`.
- **Domain** holds pure business rules and the validated app schema itself: `tables`, `auth`, `languages`, and all validation.
- **Infrastructure** talks to the database, file storage and external APIs: `connections`, `buckets`, `env`.

The dependency direction always flows inward — presentation to application to domain, with infrastructure pointing inward too — which is why declaring data and rules (`tables`, `auth`) is independent of how they are rendered (`pages`) or persisted (`buckets`).

## Next steps

- **Configuration Files** — YAML, JSON, TypeScript, and multi-file configs with `$ref`.
- **Schema Overview** — the full root-property reference.
- **Quick Start** — build and run your first app.
