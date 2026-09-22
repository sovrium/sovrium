# mcp-server-example

A headless Sovrium app that exposes tables to an LLM client via MCP

## This app at a glance

- **Tables** (2): tags, documents
- **Singletons**: auth

Config is pre-split: `app.yaml` is the entry point and `$ref`s the files under `config/`.

## Your Claude Code setup

This project ships one agent: `.claude/agents/app-editor.md`. It knows the Sovrium
config conventions and is the right agent for extending this app — adding tables and
fields, pages and views, automations, forms, and permissions.

It is a **starting point, not a fixed set**. Add your own agents under `.claude/agents/`
as your app grows (a data-modeling agent, a content agent, a deployment agent — whatever
your workflow needs).

---

A [Sovrium](https://sovrium.com) application — a self-hosted, **configuration-driven**
platform. The entire app (data model, auth, pages, design, i18n) is declared in one or more
YAML config files (a single `app.yaml` to start, split via `$ref` as the app grows) and
served by the `sovrium` runtime. There is no hand-written
server or UI code to maintain.

## How to work in this project (read first)

- **Edit `app.yaml`, not application code.** Features are added declaratively by editing
  the config, not by writing TypeScript/React/SQL. Prefer a schema change over new code.
- **Validate before running:** `sovrium validate app.yaml` checks the config against the
  schema and reports errors with paths. Always validate after editing.
- **Start with the minimum, grow as needed.** The schema supports progressive complexity —
  add tables, pages, auth, and design incrementally.
- **The authoritative contract is the schema itself:** run `sovrium schema` to print the
  full JSON Schema (Draft 2020-12) for `app.yaml`. When unsure about a property or field type,
  consult the schema rather than guessing.

## Commands

```bash
sovrium start app.yaml         # Run the app (dev server)
sovrium start app.yaml --watch # Hot-reload on config changes
sovrium validate app.yaml      # Validate the config against the schema
sovrium schema                 # Print the full JSON Schema for app.yaml
sovrium build app.yaml         # Build static output
```

## Reviewing changes in the browser

Validating is not verifying. After a config change, boot the app and drive it:

- `sovrium start app.yaml --watch` serves the app at `http://localhost:3000` (override with `PORT`)
  and hot-reloads on every save.
- Drive that running instance with Claude in Chrome — the `mcp__claude-in-chrome__*` tools. They are
  deferred: load them in one batched `ToolSearch`, call `tabs_context_mcp` first, open a **new** tab
  with `tabs_create_mcp`, and close what you opened.
- **Exercise the workflow, not just the page.** Sign in, create a record, submit the form, let the
  automation fire — then check the **effect** (the row is there, the status changed), never just
  that something rendered.
- Because `--watch` hot-reloads, the loop is: edit the config, re-navigate, re-verify. Repeat until
  the workflow passes.
- Never trigger `alert()` / `confirm()` / `prompt()` — a JS dialog freezes the extension. If Chrome
  is not connected, or calls keep failing, say so and stop rather than reporting a change as
  verified when nothing was driven.

## Scaling the config

Start with a single `app.yaml`. As the app grows, split using `$ref`.
The rule is **one purpose per file** — if you can't describe a file
in one short sentence, it's mixing concerns and wants a split.

The canonical layout is **one file per entity for collections, one file
per singleton for scoped config**. Reach for it as soon as a collection
has more than one member; don't pre-split a single-table or single-page app.

```
app.yaml                              # entry point — stays at the project root
config/design.yaml                    # singleton — all design tokens
config/auth.yaml                      # singleton — auth config
config/i18n.yaml                      # singleton — all i18n strings
config/analytics.yaml                 # singleton — analytics
config/tables/contacts.yaml           # one file per table
config/tables/orders.yaml
config/pages/landing.yaml             # one file per page
config/pages/dashboard.yaml
config/components/icon-badge.yaml     # one file per reusable component template
config/automations/on-new-order.yaml  # one file per automation
config/forms/contact-us.yaml          # one file per standalone form
config/buckets/uploads.yaml           # one file per bucket
config/connections/stripe.yaml        # one file per connection
config/agents/support-bot.yaml        # one file per AI agent
config/actions/send-slack.yaml        # one file per reusable action template
```

In `app.yaml`: `design: { $ref: './config/design.yaml' }`. Collections list
their entities: `tables: [{ $ref: './config/tables/contacts.yaml' }, …]`.
Paths resolve relative to the file containing the `$ref`.

**Root keys fall into three shapes** — split accordingly:

- **Collections** (`tables`, `pages`, `forms`, `components`, `connections`,
  `actions`, `automations`, `agents`, `buckets`, `env`) → one file per entity
  under `config/<collection>/`.
- **Singletons** (`auth`, `design`, `analytics`, `languages`, `scripts`) →
  one file per singleton at `config/<singleton>.yaml`. Never split
  these by sub-key.
- **Scalars** (`name`, `version`, `description`) → stay inline in `app.yaml`.

**When to start splitting** — once any collection has 2+ members, move that
collection to per-entity files in the same authoring pass. Below that
threshold (a single table, a single page) keep it inline — the indirection
cost isn't worth it. A single logical entity past ~300 lines is itself a
signal to split sub-concerns (e.g. a complex table's `fields` into a sidecar),
but that's a secondary split, not the primary one.

Note: reusable **component templates** are root entities (their own files);
page-instance components stay inside the page file.

Prefer YAML for readability. For IDE autocompletion and compile-time
type-checking, author a `.ts` config instead: run `sovrium types` in this
directory to write `sovrium.d.ts` and `tsconfig.json`, then

```ts
// app.ts
import type { AppConfig } from 'sovrium'

export default { name: 'my-app' } satisfies AppConfig
```

The types come out of the binary itself — no `package.json`, no `node_modules`,
no install step — so they always describe the schema the binary you run actually
accepts. Re-run `sovrium types` after upgrading it. Keep the import type-only:
the binary does not resolve bare-package specifiers, so a value import
type-checks and then fails to boot.

## The `app.yaml` schema

Root properties include: `name`, `description`, `tables`, `auth`, `pages`, `design`,
`i18n`, `analytics`, `connections`, and `agents`. Highlights:

- **`tables`** — your data model. Each table has `fields`; field `type` spans many
  categories (text, number, date/time, select, relation, attachment, rich-text, code,
  formula, AI-compute, …). The runtime generates the database, REST API, and CRUD UI.
- **`auth`** — authentication (email/password, magic link, OAuth) plus role-based access
  (`admin`, `member`, `viewer`) and field-level permissions.
- **`pages`** — composed from many built-in component types (forms, tables, kanban,
  calendar, charts, rich content, …). Server-rendered.
- **`design`** — colors, typeScale, spacing, radius, elevation, motion, breakpoints.
- **`i18n`** — multi-language content (RTL supported).

## Runtime data

On `sovrium start`, runtime artifacts are written under `.sovrium/` (git-ignored):
the zero-config SQLite database (`database.db`), the server lock file, and local file
storage. Set `DATABASE_URL` to use PostgreSQL instead. Relocate the whole folder with
the `SOVRIUM_DATA_DIR` env var. Operator settings live in **environment variables**, not
in `app.yaml`.

## Documentation

`sovrium schema` is the local contract — it prints the JSON Schema of the binary sitting in this
project. When the published docs and `sovrium schema` disagree, the schema wins: the website
describes some released version, the schema describes the one you are actually running.

- **Start at the index:** `https://sovrium.com/llms.txt` — a plain-text list of every published
  page, one titled line each with a short description. Pick a page from there instead of guessing
  a slug.
- **Fetch that page with `.md` appended.** Every docs page has a raw-markdown twin:
  `https://sovrium.com/en/docs/configuration-refs.md` is about 3.8 KB against 121 KB for the same
  page as HTML. Always take the `.md`.
- **Never fetch `https://sovrium.com/llms-full.txt`** — the entire corpus in one file, roughly 3 MB;
  a single call floods the context window. Use the index and pull one page at a time.
- The index carries English and French — prefer `/en/…`, switch to `/fr/…` when working in French.
- Docs home: https://sovrium.com/docs
- Local schema reference: `sovrium schema`
