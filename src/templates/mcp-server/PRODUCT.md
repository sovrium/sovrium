# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A team that wants its AI assistants to read and add shared documents over MCP. An admin does everything, editors read and add documents, viewers only read, and each assistant acts as the person whose key it carries.

## Product Purpose

A team's runbooks and decisions, readable by the assistant you already use: documents and tags
served over MCP, called with an API key, within what the key's owner may do.

The Team knowledge base — a fictional engineering team's runbooks, decisions, incident
write-ups and onboarding notes, served over MCP. An assistant lists, reads and adds documents
through tools the engine generates from each table's `aiAccess` block, with an API key on
`x-api-key`, and every call runs as the key's owner. One landing page at `/` says how to switch
the server on and connect a client. Nobody can open an account; the admin comes from
`AUTH_ADMIN_*`, the demo editor and viewer from the seed.

## Capabilities and Constraints

- **Tables** (2): tags, documents (each with `aiAccess` — the tools and the fields a model sees —
  and `permissions`: every role reads, an editor also creates and updates documents, only an
  admin deletes; a draft is read by its author and an admin)
- **Pages** (1): home (`/`, the developer landing)
- **Automations** (1): import-runbook — an admin's manual import of a GitHub file as a draft
  document, through the library connection `library/connection/github.yaml`, once
  `GITHUB_TOKEN` is set
- **Singletons**: design (compact, mono headings, one cyan accent), auth (sign-up closed, API
  keys on, an `editor` role)
- **Decisions** (3): `config/decisions/` — why the app is the way it is: an assistant adds
  documents but never edits them, a key acts as its owner, SQLite until the server is shared.
  Read them before changing what they touch
- **Seed**: `seed/` — four tags, eight documents (six published, one draft, one archived), and
  three accounts, one per role

Every page, table and automation of mcp-server-example is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named mcp-server-example. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
