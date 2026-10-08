# Admin Read API

> The `/api/admin/*` endpoints the operator console is built on — overview and list shapes, the users and tables overviews, the developer reads and the design-system export — every one admin-gated and answering `404` to anyone else.

The console is backed by the `/api/admin/*` read API — the same endpoints you can call directly for incident reports, on-call handoffs, or SOC 2 and GDPR review. Every endpoint is admin-gated, emits a canonical audit-log event, and returns `404` on unauthorized access.

## Endpoint shapes

| Shape        | Endpoint pattern                   | Body                                                                         |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------- |
| **Overview** | `GET /api/admin/{domain}/overview` | Period-aware totals, a bucketed time series, and derived health metrics.     |
| **List**     | `GET /api/admin/{domain}`          | Cursor-paginated items, each with an operator-grade `_admin` metadata block. |

Domains include `config`, `automations`, `users`, `tables`, `buckets` and `forms`. Overview endpoints share one period preset (`24h` / `7d` / `30d`); list endpoints accept cursor pagination, free-text search, and `?include_deleted=true`. A read that sets no caching header of its own answers `Cache-Control: no-store`.

The tables overview's period runs up to the moment it is read, its latest bucket left open: a record written an instant before the request counts in the period, even when the database clock runs slightly ahead of the server's. It answers the same numbers over HTTP and through the MCP server.

The users overview counts accounts by role. `totals.roles` lists one `{ "name", "count" }` row for every role your app can assign, sorted by name exactly as `GET /api/admin/roles` lists them: the built-in `admin`, `member` and `viewer`, the admin-tier names `admin-editor`, `admin-viewer` and `operator`, and every role declared in `auth.roles`. A role nobody holds is still listed, with `0`. `totals.without_role` counts the accounts whose stored role is empty or is no longer a role the app can assign, such as a role removed from the configuration. Those accounts are granted nothing, and their stored value is never echoed. The role counts plus `without_role` always add up to `totals.users`.

An invitation nobody has accepted yet, expired or not, is counted in `totals.invited` and nowhere else. The account it provisions is left out of `users`, the role counts, `new_in_period` and the signups series until the invitation is accepted. The dashboard's **Accounts** tile reads `totals.users`, so it leaves out pending invitations too. The MCP tool `{app}_admin_users_overview` answers the same body.

> **Upgrade note.** Versions up to 0.30.0 answered `totals.by_role` with three fixed buckets, `admin`, `operator` and `member`. Every other role, including `viewer`, a role declared in `auth.roles` and an empty value, was counted as `member`, and an invitation's account was counted in `users` before anyone accepted it. `by_role` is removed. Read `totals.roles` for the per-role counts, `totals.without_role` for the accounts no role recognises, and `totals.invited` for the invitations still pending. A client that reads `by_role` now finds no such key. Expect `totals.users` to drop by the number of pending invitations.

```bash
# Version reflection — the smallest read endpoint
curl -H 'Cookie: <admin session>' http://localhost:3000/api/admin/config/version

# Period-scoped overview
curl -H 'Cookie: <admin session>' 'http://localhost:3000/api/admin/tables/overview?period=7d'
```

## Developer reads

Four further endpoints publish what the **Developers** pages are composed from — the facts about a running instance that no static page can compute. Like every sibling above they are admin-gated and answer `404`, never `401` or `403`, to an anonymous or wrong-role caller.

| Endpoint                             | Body                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/instance`            | The instance's resolved public origin, the declared `app.version`, the declared tables in declaration order, whether `auth.apiKeys` is on, the `application_type` an OAuth client registering on this origin must send, and flat counts — `tableCount`, `mcpToolCount`, and one per MCP category. `?limit=` caps the `tables` array only; the counts stay whole.                                                                                  |
| `GET /api/admin/mcp/tools`           | The MCP tools this config exposes, as `{ tools, total }`. Each row carries the exact identifier the MCP server advertises over `tools/list`, its category (`table` / `action` / `automation`), and its own description. `?category=` narrows and `total` then counts the matches; a category outside the three is refused `400`. An empty array and a zero is the **default** posture — nothing is exposed without an explicit `aiAccess` opt-in. |
| `GET /api/admin/config/reflection`   | The redacted running configuration, serialized with two-space indentation, plus one flat count per declaration family — including the families the config leaves empty.                                                                                                                                                                                                                                                                           |
| `GET /api/admin/config/declarations` | The declaration tree's rows: each declaration's own identifier — its `path` when it has one, else its `name` — and its second level: a table's field names, an automation's trigger type, a component's type. `?family=` narrows to one of `tables`, `pages`, `forms`, `automations`, `agents`, `buckets`, `connections`; a family outside the seven is refused `400`.                                                                            |

All four publish **facts, and never a rendered string** the console would otherwise have composed: no curl line, no joined example list, no `${origin}/api`. That is what lets any config app consume them rather than only Sovrium's own console — a page gates a heading on a count, and folds rows into a code block with `code.contentFrom`.

## Design-system export

Two further read endpoints project the app's design system — its tokens plus the principles, voice and usage rules declared under `design`. Both are admin-gated and return `404` to anyone else, and neither accepts a write.

| Endpoint                            | Format                                                            |
| ----------------------------------- | ----------------------------------------------------------------- |
| `GET /api/admin/design-system.json` | A W3C Design Tokens (DTCG 2025.10) document.                      |
| `GET /api/admin/design-system.md`   | A markdown brief written to be pasted into an AI agent's context. |

They read `design` only — never an environment-variable value, never record data — so the output is safe to paste into a shared context window. The same content is available offline from `sovrium design-system`.

## Related reading

- **Admin Dashboard** — the console these endpoints serve, its access model and every page it renders.
- **Activity Monitoring** — the audit-log stream every admin call writes to.
- **Security Hardening** — RBAC, 404-not-403, rate limiting.
