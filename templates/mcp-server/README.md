# Sovrium MCP Server

> Expose your tables to an LLM over MCP.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out. This is a headless template — its surface is the REST API and the MCP endpoint, not web pages.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/mcp-server-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-mcp-server --template mcp-server
```

## What's inside

Tables with per-entity `aiAccess` exposure, served to LLM clients over the Model Context Protocol when `MCP_ENABLED=true`.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree —
no application code. Edit the config, restart, done.

## Run locally

```bash
sovrium start app.yaml
```

Zero-config: embedded SQLite, local file storage, no env vars required to boot. See
[`.env.example`](./.env.example) for the optional variables (database, auth bootstrap,
email, AI).

Load the sample knowledge base — eight documents across four tags, written to be worth
retrieving rather than to fill a grid:

```bash
sovrium seed app.yaml
```

## Turning MCP on

There is **no top-level `mcp:` block** in a Sovrium config, and there is nothing you can
put in `config/` to create one. Exposure is declared per table via `aiAccess` (see
[`config/tables/`](./config/tables)), and the server itself is switched on by the operator
through the environment:

```bash
MCP_ENABLED=true
MCP_TRANSPORT=streamable-http   # or "stdio" for a client on the same machine
MCP_AUTH_STRATEGY=oauth         # the LLM client signs in as a Sovrium user
```

The split is the point: the **schema author declares intent**, the **operator activates
it**. A config file has no business switching on a network listener in someone else's
deployment.

### Tools this app exposes

Derived from the `aiAccess` declarations in `config/tables/`, so this list moves when
those do:

| Tool                                  | Kind                              |
| ------------------------------------- | --------------------------------- |
| `mcp-server-example_documents_list`   | read-only, idempotent             |
| `mcp-server-example_documents_get`    | read-only, idempotent             |
| `mcp-server-example_documents_create` | write, requires the `editor` role |
| `mcp-server-example_tags_list`        | read-only, idempotent             |
| `mcp-server-example_tags_get`         | read-only, idempotent             |

### Notes for schema authors

- **Read-only by default.** A table opts _into_ writes by naming them in
  `aiAccess.operations`; omit `create` / `update` / `delete` and it stays readable and
  nothing else.
- **Field exposure defaults to `permissioned`** — the model sees what its role may read.
  Use `fieldExposure: whitelist` with `whitelistFields: [...]` when you want a narrower
  projection than the role's read permission gives. `documents` does; `tags` does not.
- **The `description` on each `aiAccess` block is the single biggest lever you have over
  model behaviour.** Write it for the LLM, not for a human reading the config.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see [DEPLOY.md](https://github.com/sovrium/sovrium/blob/main/DEPLOY.md)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/mcp-server`](https://github.com/sovrium/sovrium/tree/main/templates/mcp-server)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
