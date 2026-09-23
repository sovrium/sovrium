# Templates & Examples

> Start from a working app — the nineteen example configurations shipped with Sovrium, from single-capability starters to complete business apps, and the `sovrium init` templates that scaffold them.

The fastest way to learn Sovrium is to start from a working app. Sovrium ships a set of example configurations — each a complete, runnable project that composes real features (tables, auth, pages, design, i18n, automations) into a single config tree. The same examples double as `sovrium init` templates, so you can scaffold any of them into a new directory and start iterating immediately.

Every example is a **directory** with an `app.yaml` entry point. Anything beyond the smallest starter splits its configuration across a `config/` subtree using `$ref` — one file per collection entity, one file per singleton, scalars stay inline. This mirrors the structure `sovrium init` scaffolds for you.

## Starters — learn one capability at a time

- **hello-world** — minimal starter: one page, no collections. The default for `sovrium init`. Stays a single `app.yaml` to demonstrate when _not_ to pre-split.
- **landing-page** — bilingual marketing site with i18n, a design system, reusable components, and the home page split out for size.
- **blog** — blog CMS: a public index and a `/blog/:slug` detail route in front of an auth-gated `/admin` space, with a rich-text post editor, tags, authors, and an AI editor whose every write waits for human approval.
- **docs-site** — documentation website showcasing markdown pages: real `.md` files under `content/docs/`, a `contentDir` collection, a frontmatter sidebar, previous/next chrome, a table of contents, and highlighted code. No tables, no auth.
- **api-only** — headless API mode with tables and auth, no pages. Demonstrates Sovrium as a backend.
- **mcp-server** — headless MCP server exposing tables to an AI client through per-entity `aiAccess`, no pages.

## Business apps — complete, runnable systems

- **crm** — sales workspace: companies, contacts, deals and tasks across four grids plus a pipeline kanban, a contact gallery and a task calendar, with a won-deal notification and an AI assistant over every table.
- **projects** — project workspace: a dashboard, a timeline, a task kanban and a deadline calendar — four views over the same two tables.
- **helpdesk** — support desk: a public intake form feeding a triage kanban and ticket grid, with automations confirming receipt and announcing resolutions.
- **content-calendar** — editorial calendar: a month view, an editorial kanban, briefs and assets per piece, and a Monday cron emailing the team what ships this week.
- **people** — HR workspace: an employee directory with field-level salary protection, a time-off calendar, and a request flow that pauses for admin approval.
- **events** — event management: a public events page, a public registration form, email confirmation per attendee, and a calendar plus registrations grid.
- **assets** — asset tracker: barcoded, photographed, valued equipment assigned to people and grouped by location, with a quarterly inventory-check cron.
- **inventory** — stock workspace: six linked tables behind spreadsheet-style grids, an append-only movement ledger feeding database-computed rollups, and an alert emailing purchasing when stock hits zero.
- **expenses** — expense tracking: members file expenses with receipts and see only their own through row-level permissions; admins approve through a paused automation.
- **intranet** — public marketing pages plus an auth-gated portal area with role-gated sections, on magic-link and password auth.
- **knowledge-base** — internal handbook: markdown articles in Git behind sign-in, turned into a private sidebar-navigated site by one `contentDir` page.
- **automation-recipes** — automation cookbook: a webhook capturing leads, a record trigger notifying and logging, a daily-digest cron, and a failure trigger alerting the operator.
- **company-os** — a whole information system in one config: CRM, project delivery, support tickets and an HR directory, wired together with cross-domain automations and an AI assistant.

Every template checks in its own agent bundle — a `CLAUDE.md` written for that template's domain, plus a starter `app-editor` subagent. Scaffolding is a plain tree copy, so the bundle arrives with the config; there is no second install step, and a bare `sovrium init` with no `--template` gets the same agent, since `hello-world` carries the bundle like every other template.

That agent is taught to read the documentation economically — start at the `llms.txt` index, pick one page, fetch only that page rather than pulling the whole corpus — and to treat `sovrium schema` as authoritative whenever the published docs and the local binary disagree. It is also taught to verify its own work instead of declaring it done: boot with `sovrium start app.yaml --watch`, drive the affected page in a real browser, exercise the workflow, and assert on the effect — the row exists, the status changed — iterating against hot reload until it passes.

## Scaffolding a project

`sovrium init` copies a template into a new or current directory. With no `--template`, the minimal `hello-world` starter is used.

```bash
# Default (hello-world, agent bundle included)
sovrium init my-app

# Choose a template
sovrium init my-app --template crm
sovrium init my-app --template landing-page
sovrium init my-app --template helpdesk
sovrium init my-app --template company-os
```

Then run the scaffolded app:

```bash
sovrium start app.yaml          # Start the dev server
sovrium validate app.yaml       # Validate without starting
```

See **Project Commands** for every `init` flag.

## Anatomy of an example

A non-trivial example looks like this — the `crm` layout, abbreviated:

```text
crm/
├── app.yaml                 # Entry point — references everything via $ref
├── config/
│   ├── auth.yaml            # Singleton: auth strategies, roles
│   ├── design.yaml          # Singleton: the design system
│   └── tables/
│       ├── companies.yaml   # One file per table
│       └── contacts.yaml
└── public/                  # Static assets (favicon, images)
```

The `app.yaml` entry point pulls each part together with `$ref`, keeping the top-level file small and each entity in its own file:

```yaml
name: crm

auth:
  $ref: ./config/auth.yaml

design:
  $ref: ./config/design.yaml

tables:
  - $ref: ./config/tables/companies.yaml
  - $ref: ./config/tables/contacts.yaml

pages:
  - $ref: ./config/pages/sign-in.yaml
  - $ref: ./config/pages/companies.yaml
```

`$ref` resolution happens **before** validation: any object containing exactly one key — `$ref`, whose value is a relative path — is replaced with the parsed contents of that file. A `$ref` may itself contain further `$ref`s, so configs nest to any depth. The single-file and multi-file forms are interchangeable; pick whichever keeps the project readable.

**When to split.** Keep a config in one file while it is small, as `hello-world` does. Split with `$ref` once a section grows large enough to deserve its own file — typically once you have more than one table or page, or a substantial design system. The full mechanics live in **Multi-file Configs**.

## Learning path

A practical order for working through the examples:

1. **hello-world** — understand the minimal shape of a config and the `pages` array.
2. **landing-page** — add a design system, reusable components, and i18n with `$t:` translation keys.
3. **blog** and **docs-site** — dynamic routes and markdown content collections.
4. **crm** — introduce tables, auth, and data-bound pages with forms and data tables.
5. **api-only** and **mcp-server** — run Sovrium headless: as a REST backend, or facing an AI client.
6. **helpdesk** and **expenses** — automations, public intake forms, and row-level permissions.
7. **company-os** — several domains in one config, wired together with cross-domain automations.

## Related reading

- **Quick Start** — zero to running app, in YAML or in TypeScript.
- **Configuration Files** — YAML, JSON, TypeScript, and `$ref` multi-file composition.
- **CLI Overview** — `sovrium init` and the full command surface.
- **MCP Integration** — the headless MCP-server template explained.
