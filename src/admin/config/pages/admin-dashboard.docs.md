# Admin Dashboard

> The operator console at `/_admin` — an admin-only, read-only data console over records, runs, submissions, accounts, files and analytics, plus the read API behind it.

Every Sovrium app serves a native **admin dashboard** at `/_admin` — an operator console for viewing and operating on the running app's **data**. It is **prebuilt**: it ships inside the binary, version-locked to the release, and it is yours to restyle or switch off. Your own `design` paints it, and `admin: false` or `SOVRIUM_ADMIN=off` removes it so you can build your own instead.

It is a **read-only operational data console**. You inspect records, automation runs, form submissions, accounts, files and analytics; you never edit configuration here. Configuration is code-only — you change an app by editing its `app.ts` or `app.yaml` and re-deploying.

The console is itself a Sovrium app, written in the same declarative config surface your own app is written in and compiled into the binary as a preset. That is what turns the next sentence from a promise into a property:

**The operator does not edit the admin config; they edit only their own `design`. Any other modification is code, and therefore a fork.**

Page structure, navigation and the admin backend are not yours to change — and, correspondingly, nothing you write can break them. Its design is another matter: the console's default design system can be 100 % overridden by your own `design` and never removed. What cascades and what does not is **Console Customization**.

## Switching the console off

The single decision the top-level `admin` key carries is whether the console is served at all. Omit the key for the default, or write it explicitly:

```yaml
admin: false
```

`admin` is a **boolean**: omitting it, or `true`, serves the console at `/_admin`; `false` serves it nowhere. There is no path to choose and no second copy to place, so anything that is not a boolean — an object, a path string, `null` — is refused at boot.

Three things follow from the console owning the whole `/_admin` subtree:

- **Your own routes may not live inside it.** A `pages`, `forms` or `redirects` entry at or under `/_admin` is refused **at startup**, naming both sides: `admin mount "/_admin" collides with page "reports" (/_admin/reports)`. It has to be a refusal rather than a warning — the console is matched before page resolution, so the page would never render and nothing would say why. Move the page, or set `admin: false`.
- **Nothing leaks.** No console path appears in `/sitemap.xml` or in `/api/openapi.json`.
- **The environment can override the config.** `SOVRIUM_ADMIN=off` removes the console at deploy time whatever the config says, and it is deliberately not an error for the two to disagree: the config is the application's general rule, the environment is this deployment's override, and a safety switch that refused to start would be an outage.

## Access model

- **Admin-tier only.** The console and its `/api/admin/*` routes require a session whose role reaches the operator plane. That is wider than the literal `admin` role and narrower than "any signed-in caller", and five things reach it: the built-in `admin`; the two per-user tiers `admin-editor` and `admin-viewer`, where the role name _is_ the tier; a role your config declares with an explicit `dashboardTier`; your app's **top custom role**, implicitly, so an app whose highest role is `engineer` gets the console without declaring anything; and the legacy `operator` alias, unless your config claims that name for a role of its own.
- **Every admitted role gets the same access.** The tier names are an admission vocabulary, not a permission ladder: config is code-only, so there is nothing for an editor to edit that a viewer may not, and the historical split is collapsed.
- **Anonymous → 404.** Unauthenticated or non-admin requests get a `404` envelope, never a `401` or `403` — the surface's existence is unobservable (anti-enumeration; see **Security Hardening**).
- **No config editing.** There is no schema, JSON or YAML editor, no draft-then-publish, no version ledger — those were removed when Sovrium went config-code-only. The dashboard reflects state; it never mutates configuration.
- **English-only.** The console renders its own chrome in English — sign-in, sidebar, headings, table columns, empty states, confirmations, toasts. It pins that language rather than negotiating it, so an operator on a French-locale browser still gets a consistent console instead of a half-translated one. This is the console's own interface only: **your app is unaffected** and still renders in whatever language its `languages` config declares.

### Signing in

The sign-in page is at **`/_admin/login`**. Everything else under `/_admin` answers `404` until you hold an admin session — including `/_admin` itself, which returns `404` rather than redirecting you to the sign-in page, because the console does not advertise its own existence.

Nothing on the site links there, so the **startup banner** is where the address is published. Whenever the console is served and the app declares `auth`, the banner prints it directly under the bare server URL:

```text
→ http://localhost:3000
→ Admin console: http://localhost:3000/_admin/login
```

The row is absent in exactly the two cases where it would be a dead end: when the console is switched off, and when the app declares no `auth` block, since there is then no admin session to hold. Once you are signed in, `/_admin/login` redirects to the console root.

![The /_admin/login sign-in page — a "Sign in to the console" card with email and password fields](/docs/screenshots/admin/login.avif)

## Overview

The console root (`/_admin`) is a **Dashboard** overview: at-a-glance KPI tiles and a short activity trend across the app's domains — records written, automation runs, form submissions, users — over a shared period preset (`24h` / `7d` / `30d`).

![The /_admin overview — the console shell with the Application, System, and Developers sidebar, and KPI tiles for records, submissions, automation runs, users, storage, and connections](/docs/screenshots/admin/overview.avif)

A tile whose source cannot be read falls back to zero rather than failing the whole page, so one unavailable domain never takes the dashboard down with it. `GET /api/admin/overview` marks those blocks so you can tell the two apart: a block whose figures are a fallback carries `"degraded": true` beside them, and a block that was actually measured carries no such key. There is no `"degraded": false` — the key is present only when the number is not a measurement.

```json
{
  "records": { "total": 1284 },
  "submissions": { "total": 0, "degraded": true },
  "users": { "total": 12 }
}
```

Here the instance really holds 1,284 records and 12 users, while the submissions ledger could not be read at all — its `"total": 0` is a placeholder, not a count. Treat a degraded block as _unknown_ rather than _empty_, both when reading the console and when alerting on the endpoint.

## Every page the console serves

The console's whole surface, in sidebar order. A page whose address ends in a parameter is the detail view of the list above it, and is reached from it. The design-system section has seven pages of its own; they are **Design System Console**.

| Route                       | What it is                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `/_admin`                   | Dashboard overview — KPI tiles and the shared activity trend.                                  |
| `/_admin/tables`            | Records: every table's rows, with counts, soft-delete counts and write series.                 |
| `/_admin/tables/:table`     | One table's records — sort, filter, open a row in a detail drawer.                             |
| `/_admin/forms`             | The configured forms, with submission counts and completion rates.                             |
| `/_admin/forms/:form`       | One form: its submissions inbox and, on a second tab, its analytics.                           |
| `/_admin/buckets`           | Storage buckets, with usage over the shared period preset.                                     |
| `/_admin/buckets/:bucket`   | The files inside one bucket, with size and MIME type.                                          |
| `/_admin/automations`       | Automation-engine health, and run history with status, duration and a per-step trace.          |
| `/_admin/agents`            | The app's conversation-source agents.                                                          |
| `/_admin/agents/default`    | The default agent's conversation history.                                                      |
| `/_admin/agents/:agent`     | One agent's conversations and their messages.                                                  |
| `/_admin/links`             | Every short link the instance serves, and which ones this operator may change.                 |
| `/_admin/links/:slug`       | One link: its traffic split across targets, and the mint, re-point and kill controls.          |
| `/_admin/connections`       | Outbound credentials this app presents to third parties, with token and expiry status.         |
| `/_admin/users`             | The account directory and role distribution, with an invite affordance and per-user role edit. |
| `/_admin/users/invitations` | Outstanding invitations — issue, resend, revoke.                                               |
| `/_admin/users/:email`      | One account.                                                                                   |
| `/_admin/organisation`      | The access graph: who reaches what, resolved in one read.                                      |
| `/_admin/pages`             | Privacy-friendly page analytics.                                                               |
| `/_admin/footprint`         | What serving that audience consumed.                                                           |
| `/_admin/env`               | Which declared environment variables this instance actually resolved.                          |
| `/_admin/decisions`         | The decision register this config declares.                                                    |
| `/_admin/decisions/:id`     | One decision.                                                                                  |
| `/_admin/api`               | The Scalar-rendered OpenAPI reference, and API-key management on a second tab.                 |
| `/_admin/mcp`               | How to connect an AI client over the Model Context Protocol.                                   |
| `/_admin/changelog`         | What this instance has booted, release by release.                                             |
| `/_admin/changelog/:hash`   | What changed between two boots.                                                                |
| `/_admin/design-system`     | The design-system section — see **Design System Console**.                                     |
| `/_admin/api-keys`          | The signed-in operator's own long-lived credentials: mint, copy once, revoke.                  |
| `/_admin/profile`           | The signed-in operator's own account.                                                          |
| `/_admin/gdpr`              | The signed-in user's own data export and account erasure.                                      |
| `/_admin/login`             | The public sign-in card.                                                                       |
| `/_admin/forgot-password`   | Request a recovery mail.                                                                       |
| `/_admin/reset-password`    | Set a new password from a recovery link.                                                       |

![The Records surface — a tickets table with sortable columns, status badges, and a records toolbar](/docs/screenshots/admin/records.avif)

![The Submissions surface — a per-form submissions inbox with an empty state and CSV export](/docs/screenshots/admin/submissions.avif)

![The Files surface — a bucket file browser with a drag-and-drop upload zone](/docs/screenshots/admin/files.avif)

![The Runs surface — automation-run history with status badges, duration, and per-automation filters](/docs/screenshots/admin/automation-runs.avif)

![The Users surface — the account directory with role, status, and per-user actions](/docs/screenshots/admin/users.avif)

A **⌘K search** is available from anywhere in the console: a global, indexed command palette that jumps to any record or surface.

![The ⌘K command palette open over the console — a "Search all your data" input](/docs/screenshots/admin/search.avif)

The console also drops pages your instance has no use for. An API-keys page on an instance where `auth.apiKeys` is off is a nav entry leading somewhere empty, so it is not served at all: it `404`s and appears in no listing.

## The read API

The console is backed by the `/api/admin/*` read API — the same endpoints you can call directly for incident reports, on-call handoffs, or SOC 2 and GDPR review. Every endpoint is admin-gated, emits a canonical audit-log event, and returns `404` on unauthorized access.

| Shape        | Endpoint pattern                   | Body                                                                         |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------- |
| **Overview** | `GET /api/admin/{domain}/overview` | Period-aware totals, a bucketed time series, and derived health metrics.     |
| **List**     | `GET /api/admin/{domain}`          | Cursor-paginated items, each with an operator-grade `_admin` metadata block. |

Domains include `config`, `automations`, `users`, `tables`, `buckets` and `forms`. Overview endpoints share one period preset (`24h` / `7d` / `30d`); list endpoints accept cursor pagination, free-text search, and `?include_deleted=true`.

```bash
# Version reflection — the smallest read endpoint
curl -H 'Cookie: <admin session>' http://localhost:3000/api/admin/config/version

# Period-scoped overview
curl -H 'Cookie: <admin session>' 'http://localhost:3000/api/admin/tables/overview?period=7d'
```

### Developer reads

Four further endpoints publish what the **Developers** pages are composed from — the facts about a running instance that no static page can compute. Like every sibling above they are admin-gated and answer `404`, never `401` or `403`, to an anonymous or wrong-role caller.

| Endpoint                             | Body                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/instance`            | The instance's resolved public origin, the declared `app.version`, the declared tables in declaration order, whether `auth.apiKeys` is on, the `application_type` an OAuth client registering on this origin must send, and flat counts — `tableCount`, `mcpToolCount`, and one per MCP category. `?limit=` caps the `tables` array only; the counts stay whole.                                                                                  |
| `GET /api/admin/mcp/tools`           | The MCP tools this config exposes, as `{ tools, total }`. Each row carries the exact identifier the MCP server advertises over `tools/list`, its category (`table` / `action` / `automation`), and its own description. `?category=` narrows and `total` then counts the matches; a category outside the three is refused `400`. An empty array and a zero is the **default** posture — nothing is exposed without an explicit `aiAccess` opt-in. |
| `GET /api/admin/config/reflection`   | The redacted running configuration, serialized with two-space indentation, plus one flat count per declaration family — including the families the config leaves empty.                                                                                                                                                                                                                                                                           |
| `GET /api/admin/config/declarations` | The declaration tree's rows: each declaration's own identifier — its `path` when it has one, else its `name` — and its second level: a table's field names, an automation's trigger type, a component's type. `?family=` narrows to one of `tables`, `pages`, `forms`, `automations`, `agents`, `buckets`, `connections`; a family outside the seven is refused `400`.                                                                            |

All four publish **facts, and never a rendered string** the console would otherwise have composed: no curl line, no joined example list, no `${origin}/api`. That is what lets any config app consume them rather than only Sovrium's own console — a page gates a heading on a count, and folds rows into a code block with `code.contentFrom`.

### Design-system export

Two further read endpoints project the app's design system — its tokens plus the principles, voice and usage rules declared under `design`. Both are admin-gated and return `404` to anyone else, and neither accepts a write.

| Endpoint                            | Format                                                            |
| ----------------------------------- | ----------------------------------------------------------------- |
| `GET /api/admin/design-system.json` | A W3C Design Tokens (DTCG 2025.10) document.                      |
| `GET /api/admin/design-system.md`   | A markdown brief written to be pasted into an AI agent's context. |

They read `design` only — never an environment-variable value, never record data — so the output is safe to paste into a shared context window. The same content is available offline from `sovrium design-system`.

## Related reading

- **Console Customization** — how your `design` paints the console, what it never touches, and the floor you cannot remove.
- **Design System Console** — the design-system section and its revocable share link.
- **User Management** — the mutating admin operations the dashboard reflects.
- **Activity Monitoring** — the audit-log stream every admin call writes to.
- **Analytics** — the traffic-analytics read surface.
- **Security Hardening** — RBAC, 404-not-403, rate limiting.
