# Sovrium Example Configurations

Each example is a **directory** containing an `app.yaml` entry point plus a `config/` subtree split per the conventions documented in the scaffolded `CLAUDE.md` (one file per collection entity, one file per singleton, scalars stay inline). Use these as starting points or references when building your own app.

The catalog has two tiers:

- **Starters** teach the platform — each one demonstrates a capability (pages, tables, headless API, MCP, markdown content) with the smallest possible config.
- **Business apps** do a job — ready-to-deploy templates for the tools an organization runs on (the seed catalog of the Sovrium Apps gallery). Fork one, rename the tables, and it's yours.

Every template also ships a `CLAUDE.md` describing that app's structure and a single starter agent at `.claude/agents/app-editor.md`, so Claude Code is productive in a scaffolded project immediately. Add your own agents next to it as the project grows.

## Starters

| Template         | Description                                                                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **hello-world**  | Minimal starter. One page, no collections. Default template for `sovrium init`. Stays a single `app.yaml` to demonstrate when not to pre-split.                                                                                                                                                                      |
| **landing-page** | Bilingual marketing site with i18n, theme, 5 reusable components, and the home page split out for size.                                                                                                                                                                                                              |
| **blog**         | Blog with posts (rich-text), tags, authors, and an index + dynamic `/blog/:slug` detail route.                                                                                                                                                                                                                       |
| **docs-site**    | Documentation website (Astro Starlight / Docusaurus alternative) showcasing the **markdown pages** feature: real `.md` files under `content/docs/`, a `contentDir` collection generating one route per file, a frontmatter-grouped sidebar, prev/next chrome, a TOC, and Shiki-highlighted code. No tables, no auth. |
| **api-only**     | Headless API mode with tables (projects, tasks) and auth. No pages.                                                                                                                                                                                                                                                  |
| **mcp-server**   | Headless MCP server exposing tables to an LLM client via per-entity `aiAccess`. No pages.                                                                                                                                                                                                                            |

## Business apps

| Template               | Description                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **crm**                | Sales CRM with tables (companies, contacts, deals, tasks), email/password auth, theme, an AI records assistant, a deal-won email automation, and grid/kanban/calendar/gallery pages.                                                                                           |
| **projects**           | Project management: a Gantt **timeline**, a task kanban, a deadline calendar, and a KPI + chart dashboard — four views over two tables, plus a blocked-task email automation.                                                                                                  |
| **helpdesk**           | Customer support: a **public intake form** at `/support` (no sign-in, honeypot anti-spam) feeding a triage kanban, plus automations that confirm receipt and email the requester on resolution.                                                                                |
| **content-calendar**   | Marketing content planning: a month calendar, an editorial kanban (idea → published), briefs and attachments per piece, and a Monday-morning **cron** digest automation.                                                                                                       |
| **people**             | HR workspace: an employee photo directory with **field-level permissions** (salary is admin-only, server-side), a time-off calendar, and an **approval automation** that pauses until an admin signs off each request.                                                         |
| **events**             | Event management: a public events page and registration form, automatic confirmation emails, an organizer calendar, and a registrations grid grouped by event.                                                                                                                 |
| **assets**             | Asset tracker: **barcoded** equipment with photos and values, grouped by location, a lifecycle kanban, and a quarterly inventory-check cron.                                                                                                                                   |
| **expenses**           | Expense approvals: receipts in a named **bucket**, **row-level permissions** (members see only their own expenses), an admin approval automation, and a spend-by-category dashboard.                                                                                           |
| **intranet**           | Company intranet: a public welcome page + an auth-gated employee hub with announcements, a people directory, shared resources, and role-gated manager tools. Magic-link + password auth.                                                                                       |
| **knowledge-base**     | Internal company handbook: the markdown `contentDir` feature **behind sign-in** — onboarding, IT how-tos, and policies as `.md` files in Git, readable only by authenticated employees.                                                                                        |
| **automation-recipes** | The Zapier-replacement showcase: four recipes covering the trigger families — **webhook** → record, record → email + log, **cron** digest, and a global **automation-failure** alert — with infinite run history in your own database.                                         |
| **company-os**         | The flagship: an **entire information system in one config** — CRM pipeline, project delivery, support tickets, and HR share one database; a won deal auto-opens its delivery project, resolved tickets email the CRM contact, and one AI assistant works across every domain. |

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
