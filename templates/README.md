# Sovrium Example Configurations

Each example is a **directory** containing an `app.yaml` entry point plus a `config/` subtree split per the conventions documented in the scaffolded `CLAUDE.md` (one file per collection entity, one file per singleton, scalars stay inline). Use these as starting points or references when building your own app.

The catalog has two tiers:

- **Starters** teach the platform — each one demonstrates a capability (pages, tables, headless API, MCP, markdown content) with the smallest possible config.
- **Business apps** do a job — ready-to-deploy templates for the tools an organization runs on (the seed catalog of the Sovrium Apps gallery). Fork one, rename the tables, and it's yours.

Every template also ships a `CLAUDE.md` describing that app's structure. Run `sovrium skills` in a scaffolded project to write the Agent Skills for your Sovrium version into `.claude/skills/`, so an AI assistant is productive in it immediately.

## Starters

| Template         | Description                                                                                                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **hello-world**  | The first page after `sovrium init`: it says the app runs, shows the **`app.yaml` lines** that make it, links the docs and the templates, follows the system scheme, and answers a missing route with a 404. One file, with its **`app.ts` twin**.                                                    |
| **landing-page** | Tablée: a **bilingual** product landing page at `/en/` and `/fr/` — one sentence, the product itself, three features, three steps, and a **demo request form** the owner reads in the admin; a PNG sharing card per language, closed sign-up.                                                         |
| **blog**         | Field Notes: an index of **essays with covers**, one page per essay with its byline and the comments the editor **approved**, an **RSS feed**, and a desk where a draft given a date is **scheduled** and published by an hourly **cron**; closed sign-up.                                            |
| **docs-site**    | Docs: a documentation website whose pages are **markdown files** under `content/docs/` — a landing page with the one command, a sidebar in sections, an outline, last-updated dates, an **edit link** to each file, typed callouts, highlighted code and a 404 with the way back. No tables, no auth. |
| **api-only**     | Task API: projects and tasks behind a **REST API** called with an **API key**, **per-role rules** on every table (a viewer's write answers 404), each record's **history**, and one landing page with the call to paste; closed sign-up.                                                              |
| **mcp-server**   | Team knowledge base: runbooks and decisions served over **MCP** to the assistant you already use, called with an **API key** whose owner's **role** decides the tools (a viewer's write is refused), and one landing page with the client configuration to paste; closed sign-up.                     |

## Business apps

| Template               | Description                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **crm**                | Kestrel CRM: a sales pipeline board with forecast figures and folded Won/Lost columns, contacts and companies that open in a drawer, tasks on a calendar, an AI records assistant, closed sign-up, and seeded demo accounts.                                                      |
| **projects**           | Fernhill Projects: a dashboard of what is late and who carries the work, a task board with a folded Done column and a task drawer, a timeline of every task by project with its dependencies, a calendar beside your own tasks, closed sign-up, and seeded demo accounts.         |
| **helpdesk**           | Tallyline Support: a **public ticket form** on `/` with a screenshot and no account, a queue by status with who holds each ticket and Unassigned / Mine tabs, tickets that open in a drawer with their conversation, a rating once resolved, and seeded demo accounts.            |
| **content-calendar**   | Loomwork Content: every piece on a month marked by its channel, a pipeline where a piece in Review waits for the lead's **approval in the app**, campaigns on a strip, and a Monday **cron** digest.                                                                              |
| **people**             | HR workspace: a directory where each **salary is withheld from everyone but an admin** (server-side), a time-off calendar by name, and requests an **admin approves in the app**.                                                                                                 |
| **events**             | Fieldday Events: a public page of what is on with the seats left, registration with no account, a waitlist for a full event, an organizer Overview with the month, and every registration grouped by event with a check-in at the door.                                           |
| **assets**             | Arden Assets: a register grouped by category with each asset's tag, holder and place, check-outs with return dates, the assets missing at the last count, a lifecycle board with a folded Retired column, no sign-up, and seeded demo accounts.                                   |
| **inventory**          | Brunel Stock: a catalogue grouped by category with stock on hand and value at cost, a reorder list, a signed stock ledger per warehouse, an order board with folded Shipped/Cancelled columns, an AI assistant that drafts purchase orders, no sign-up, and seeded demo accounts. |
| **expenses**           | Expense claims: each person **sees only their own claims** (row-level, server-side) with the receipt on each, finance **approves in the app** with the receipt beside the claim, and approved claims are marked repaid.                                                           |
| **intranet**           | Halden Intranet: a public welcome, sign-in by an **emailed link** with a password fallback, a Home with the must-read and how many have acknowledged it, the news, a searchable directory, resources, and a Publish page for **managers only**.                                   |
| **knowledge-base**     | Corvel handbook: markdown articles in sections **behind sign-in**, an outline and previous / next that follow the sidebar, a section for **managers only**, a search that answers with what the reader may open, and an assistant.                                                |
| **automation-recipes** | Kerlo Automations: four recipes that run inside the app — a **webhook** behind a bearer token writes leads, a record trigger emails and logs each with **retries**, a weekday **cron** digest, a failure handler — shown as their config, with a week of runs.                    |
| **company-os**         | Orrin OS: a home with one figure per module and what waits on you, a deal pipeline, clients that open with their deals, projects and tickets, a task board, a ticket board, a time-off calendar, one AI assistant, closed sign-up, and seeded demo accounts.                      |

## Deliberately out of scope

Some Odoo-style modules are intentionally **not** in this catalog:

- **Accounting** (double-entry ledgers, taxes, bank reconciliation) — accounting-grade correctness is jurisdiction-specific and audit-critical; pair Sovrium with dedicated accounting software. The `expenses` template covers the approval-trail 20% most teams actually need.
- **Manufacturing / MRP, point-of-sale, VoIP, IoT** — hardware- and real-time-heavy domains outside what a config interpreter should promise.
- **eCommerce with payments, bulk email/SMS campaigns** — payment rails and deliverability infrastructure are external services; the `content-calendar` template tracks campaigns without pretending to send them.

## Quick Start

### Create a new project

```bash
# Default (no --template: a minimal app.yaml + CLAUDE.md + starter agent)
sovrium init my-app

# Starters
sovrium init my-app --template landing-page
sovrium init my-app --template blog
sovrium init my-app --template docs-site
sovrium init my-app --template api-only
sovrium init my-app --template mcp-server

# Business apps
sovrium init my-app --template crm
sovrium init my-app --template projects
sovrium init my-app --template helpdesk
sovrium init my-app --template content-calendar
sovrium init my-app --template people
sovrium init my-app --template events
sovrium init my-app --template assets
sovrium init my-app --template inventory
sovrium init my-app --template expenses
sovrium init my-app --template intranet
sovrium init my-app --template knowledge-base
sovrium init my-app --template automation-recipes
sovrium init my-app --template company-os
```

### Run your app

```bash
# Start the development server
sovrium start app.yaml

# Validate your config without starting
sovrium validate app.yaml

# Print the JSON Schema for reference
sovrium schema
```

> Templates that declare an AI agent (`crm`, `company-os`) need an AI provider
> at runtime: set `AI_PROVIDER` (e.g. `ollama` with `AI_BASE_URL`) before
> `sovrium start`. `sovrium validate` works without one.

### Modify and iterate

Edit your YAML file and restart the server. Sovrium validates your config against the AppSchema on every start, so you get immediate feedback on errors.

## Schema Reference

Run `sovrium schema` to print the full JSON Schema, or see `src/domain/models/app/index.ts` for the Effect Schema source.

### Key sections

- **name** (required) -- App name (npm naming conventions)
- **version** -- SemVer version string
- **description** -- Single-line description
- **auth** -- Authentication strategies, roles, 2FA
- **tables** -- Data models with typed fields and relationships
- **theme** -- Colors, fonts, spacing, shadows, border radius
- **languages** -- i18n with translations and browser detection
- **components** -- Reusable UI component templates
- **pages** -- Server-rendered pages with sections and metadata
- **forms** -- Standalone (optionally public) forms that write to tables
- **automations** -- Triggers (record, cron, webhook, form, failure) + actions
- **buckets** -- Named storage buckets with per-bucket permissions
- **agents** -- AI agents with RBAC roles and double-gated table access

### Field types

Tables support these field types: `single-line-text`, `long-text`, `rich-text`, `email`, `phone-number`, `url`, `integer`, `decimal`, `currency`, `percentage`, `checkbox`, `single-select`, `multi-select`, `date`, `duration`, `single-attachment`, `multiple-attachments`, `relationship`, `lookup`, `rollup`, `formula`, `user`, `created-by`, `updated-by`, `created-at`, `updated-at`, `autonumber`, `barcode`, `color`, `geolocation`, `json`, `rating`, `progress`, `status`, `button`, `count`, `array`.
