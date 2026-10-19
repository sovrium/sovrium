# Admin Read API

> The `/api/admin/*` endpoints the operator console is built on — overview and list shapes, the users and tables overviews, the developer reads, the organisation graph and the design-system export — every one admin-gated and answering `404` to anyone else.

The console is backed by the `/api/admin/*` read API — the same endpoints you can call directly for incident reports, on-call handoffs, or SOC 2 and GDPR review. Every endpoint is admin-gated, emits a canonical audit-log event, and returns `404` on unauthorized access.

## Endpoint shapes

| Shape        | Endpoint pattern                   | Body                                                                         |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------- |
| **Overview** | `GET /api/admin/{domain}/overview` | Period-aware totals, a bucketed time series, and derived health metrics.     |
| **List**     | `GET /api/admin/{domain}`          | Cursor-paginated items, each with an operator-grade `_admin` metadata block. |

Domains include `config`, `automations`, `users`, `tables`, `buckets` and `forms`. Overview endpoints share one period preset (`24h` / `7d` / `30d`); list endpoints accept cursor pagination, free-text search, and `?include_deleted=true`. The automation run history also answers a page by number (`?page=2&limit=25`) and reports the `total` of the runs matching its filters, how many of them failed or wait, and that count as one sentence in the operator's language, so a reader can number its pages. A read that sets no caching header of its own answers `Cache-Control: no-store`.

The connections list and detail, `GET /api/admin/connections` and `GET /api/admin/connections/:id`, name each connection with one `label`: the `label` its configuration declares, when it declares one; otherwise its `name` and `provider` joined by a middle dot with a space either side (`pennylane-prod · pennylane`), or the `name` alone when the two are the same word, compared without regard to case. It is built from the configuration's own words, so it reads the same in every language; `name` and `provider` stay on the row beside it.

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

## Organisation graph

`GET /api/admin/organisation/graph` is the one read behind the console's **Organisation** page: who can reach what in the running configuration, and what looks wrong in it. Like its siblings it is admin-gated and answers `404` to anyone else, and it stores nothing — the graph is worked out from the configuration and the accounts on every read. The MCP tool `{app}_admin_organisation_graph` answers the same body.

| Key                                   | What it holds                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes`                               | The people and agents, the roles and teams they stand in, the open rung (everyone, or any signed-in person), the tables, pages, forms, buckets and agents they reach, and the automations with their steps. Each node has an `id`, a `kind` and a `label` naming it; a person or agent adds how many sources it holds, how many resources it reaches and can change, and how many it reaches by more than one route. |
| `edges`                               | What joins two nodes: a person standing in a role or team, a grant from a role, a team or the open rung to a resource, with the operations it allows, a trigger, an escalation or one step of an automation to the next. Each edge carries the labels of both ends.                                                                                                                                                  |
| `findings`                            | What looks wrong, gravest first: a write reachable without signing in, a resource readable through the open rung, or one person who alone joins two otherwise separate parts of the graph. Each finding has a `severity` (`critical`, `warning` or `notice`), how many people it exposes (`"unbounded"` when anyone can), the names it concerns, one sentence saying it, and the `nodes` it names.                   |
| `findingsCount`, `findingsBySeverity` | How many findings there are, in all and per severity. The Overview's **Findings** item reads the same count.                                                                                                                                                                                                                                                                                                         |
| `exceptions`                          | Every per-field restriction and per-row rule a table declares, which a grant alone does not show.                                                                                                                                                                                                                                                                                                                    |
| `degraded`                            | The sources that could not be read, so their part of the graph is missing rather than empty. Empty on a healthy read.                                                                                                                                                                                                                                                                                                |

Every node carries `inFinding`: `true` when at least one finding names it in its `nodes`, `false` otherwise, never absent. It is what the page's graph reads to mark the nodes a finding concerns, and what a page of your own can bind a graph's `flag` to.

`?node=<id>` narrows the graph to one node, everything it reaches and everything that reaches it, with the edges and exceptions between them, and echoes the id back as `appliedNode`. The findings and `degraded` are not narrowed, since they describe the instance rather than the node. An id that names nothing answers `200` with an empty graph; a malformed one answers `400`.

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
