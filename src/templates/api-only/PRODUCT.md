# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sovrium configuration (app.yaml + config/), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.

## Users

A developer who needs a backend for a script, an integration or another front-end. Its callers are an admin, members who read and write, and viewers who only read, each through an API key.

## Product Purpose

Projects and tasks behind a REST API, called with an API key, with per-role rules on every
table and one page that says how to call it.

The Task API — the backlog of a fictional engineering team behind a REST API: projects and
tasks, called with an API key on `x-api-key`, with per-role rules on every table and one
landing page at `/` that gives the command, the call and the tables. Nobody can open an
account; the admin comes from `AUTH_ADMIN_*`, the demo member and viewer from the seed.

## Capabilities and Constraints

- **Tables** (2): projects, tasks (each with a `permissions` block: every role reads, admin and
  member create and update, only admin deletes; a refused call answers 404)
- **Pages** (1): home (`/`, the developer landing)
- **Automations** (3): task-intake (a webhook that files a task, its body signed in
  `X-Signature`), task-done-call-out (a signed call to `TASK_EVENTS_URL` when a task is done),
  and record-to-linear-issue — a library recipe (`library/recipe/`, with its
  `library/connection/linear.yaml`) mirroring each new task into Linear. All three are idle
  until their `env` keys are set
- **Singletons**: design (compact, mono headings, one teal accent), auth (sign-up closed, API
  keys on)
- **Seed**: `seed/` — five projects, ten tasks (eight open, two done, every open task
  assigned), and three accounts, one per role

Every page, table and automation of task-api is declared in its configuration and run by the Sovrium binary; there is no application code to change.

## Brand Commitments

The product is named task-api. Copy addresses the reader as "you".

## Evidence on Hand

Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.
