# Team knowledge base — an MCP server

> A team's runbooks and decisions, readable by the assistant you already use: documents and tags
> served over MCP, called with an API key, within what the key's owner may do.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/mcp-server-template)

## Connect a client

Switch the server on, seed the knowledge base, and start:

```bash
sovrium seed app.yaml        # needs SOVRIUM_SEED_PASSWORD, see .env.example
MCP_ENABLED=true MCP_TRANSPORT=streamable-http sovrium start app.yaml
```

A key is minted by a signed-in person and carries their role. Sign in as the editor and ask for
one (the value is shown once):

```bash
curl -c jar -H "content-type: application/json" \
  -d '{"email":"marco.bianchi@teamkb.example","password":"<SOVRIUM_SEED_PASSWORD>"}' \
  localhost:3000/api/auth/sign-in/email
curl -b jar -H "content-type: application/json" -d '{"name":"my assistant"}' \
  localhost:3000/api/auth/api-key/create      # → { "key": "…" }
```

An admin can also create keys in the console, at `/_admin/api-keys`. Then give your client the
server's address and the key:

```json
{
  "mcpServers": {
    "team-kb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "x-api-key": "<your key>" }
    }
  }
}
```

The server speaks MCP protocol revision 2026-07-28 over streamable HTTP. A client that signs in
through the browser can use OAuth instead: `/mcp` also accepts an access token on
`Authorization: Bearer`, and the key's owner is then whoever signed in.

Then ask: "How do I rotate the database credentials?" The assistant lists the documents, reads
the runbook of that name, and answers with its four steps.

## What's inside

The knowledge base of a fictional engineering team: eight documents — runbooks, decisions, an
incident write-up, onboarding notes — under four tags. The page at `/` says how to switch the
server on and connect a client, and lists the tools. The admin console at `/_admin` is where
keys, roles and documents are managed.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no
application code. Replace the tables in `config/tables/` and the documents in `seed/`.

### The tools

Each table's `aiAccess` block says which tools exist and which fields they return. The names
below are the ones `tools/list` returns; each carries the app's `name` as its prefix, so they
follow when you rename the app:

| Tool                                  | Kind      | Who may call it        |
| ------------------------------------- | --------- | ---------------------- |
| `mcp-server-example_documents_list`   | read-only | every role             |
| `mcp-server-example_documents_read`   | read-only | every role             |
| `mcp-server-example_documents_create` | writes    | an editor and an admin |
| `mcp-server-example_tags_list`        | read-only | every role             |
| `mcp-server-example_tags_read`        | read-only | every role             |

The documents tools return `title`, `body`, `tag` and `status` — the author and the timestamps
stay on the server. There is no update or delete tool: adding a document is easy to review and
undo, a silent edit is not.

### The seeded accounts

Nobody can open an account from outside. The admin comes from `AUTH_ADMIN_EMAIL` and
`AUTH_ADMIN_PASSWORD`; the editor and the viewer from `seed/users.yaml`, with the password in
`SOVRIUM_SEED_PASSWORD`:

| Account                        | Role   | What their key may do                              |
| ------------------------------ | ------ | -------------------------------------------------- |
| `priya.nair@teamkb.example`    | admin  | everything, drafts included; the admin console     |
| `marco.bianchi@teamkb.example` | editor | list and read documents and tags, create documents |
| `elin.sundberg@teamkb.example` | viewer | list and read documents and tags                   |

A tool call runs as the key's owner, with their role read afresh on every call: the assistant
can never write what its owner could not.

## What to try

- **Without a key**, `/mcp` answers `401` and names no tool.
- **With Elin's key** (the viewer), the client lists four tools, and a call to
  `mcp-server-example_documents_create` is refused — nothing is written.
- **With Marco's key**, ask the assistant to record a postmortem draft ("Postmortem — disk
  full"). Sign in to `/_admin` as Priya and it is there, as a draft.
- **The draft on MCP transports** is in the seed but not in what the list tool returns to Elin:
  a draft is read by its author and by an admin only.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically, and `MCP_ENABLED=true` and
`MCP_TRANSPORT=streamable-http` come preset; you only fill in `BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config (see the
[deployment guides](https://sovrium.com/en/docs/installation)).

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/mcp-server`](https://github.com/sovrium/sovrium/tree/main/templates/mcp-server)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
