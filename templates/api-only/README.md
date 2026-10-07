# Task API — a headless API

> Projects and tasks behind a REST API, called with an API key, with per-role rules on every
> table and one page that says how to call it.

Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config
file in, a complete self-hosted web application out.

[![Deploy on Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://dashboard.scalingo.com/create/app?source=https://github.com/sovrium/api-only-template)

## Use this template

Click **Use this template** on GitHub to copy this app into your own repository (clean
history, yours to modify), or scaffold it locally:

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium init my-api --template api-only
```

## What's inside

The Task API, the backlog of a fictional engineering team: five projects and ten tasks behind
the REST API the engine generates from two tables — list, filter, sort and page, create,
update, soft delete and restore, and the history of every record. Scripts call it with an API
key on the `x-api-key` header.

Each table says who may do what: an **admin** reads, writes and deletes; a **member** reads,
creates and updates; a **viewer** only reads. A call that is not allowed answers **404**, never
403, so the API does not confirm what it refuses. Nobody can open an account: the admin comes
from `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD`, the demo member and viewer from
`seed/users.yaml`.

The one page, at `/`, gives the command, the call and the tables. The reference of every
endpoint (`/api/scalar`) and the admin console (`/_admin`) open for an admin.

Three optional automations sit beside the API. Set `TASK_WEBHOOK_SECRET` and another system
can file a task with a signed `POST` to `/api/automations/task-intake/webhook` (the steps are
in [`config/automations/task-intake.yaml`](./config/automations/task-intake.yaml)); set
`TASK_EVENTS_URL` too and each task marked done is announced there, signed the same way. Set
`LINEAR_API_KEY` and `LINEAR_TEAM_ID` and each new task is mirrored as a Linear issue, through
the `record-to-linear-issue` recipe from the Sovrium library (`sovrium library add
recipe/record-to-linear-issue`). Without them the app runs exactly the same.

Everything is declared in [`app.yaml`](./app.yaml) and the [`config/`](./config) tree — no
application code. Replace the tables in `config/tables/`, the backlog in `seed/`.

## Run locally

```bash
sovrium seed app.yaml        # needs SOVRIUM_SEED_PASSWORD, see .env.example
sovrium start app.yaml --watch
```

Zero-config otherwise: embedded SQLite, local file storage. The seed creates three accounts,
one per role, all with the password in `SOVRIUM_SEED_PASSWORD`:

| Account                          | Role   |
| -------------------------------- | ------ |
| `nora.lindqvist@taskapi.example` | admin  |
| `samir.haddad@taskapi.example`   | member |
| `julia.weber@taskapi.example`    | viewer |

## Call it

A key is minted by a signed-in person and carries their role. Sign in as the member and ask
for one (the value is shown once):

```bash
curl -c jar -H "content-type: application/json" \
  -d '{"email":"samir.haddad@taskapi.example","password":"<SOVRIUM_SEED_PASSWORD>"}' \
  localhost:3000/api/auth/sign-in/email
curl -b jar -H "content-type: application/json" -d '{"name":"my script"}' \
  localhost:3000/api/auth/api-key/create      # → { "key": "…" }
export TASK_API_KEY=<the key>
```

An admin can also create keys in the console, at `/_admin/api-keys`. Then the call — the open
tasks, the one due soonest first:

```bash
curl -H "x-api-key: $TASK_API_KEY" \
  "localhost:3000/api/tables/tasks/records?filter=done:false&sort=due_date:asc"
```

It answers 200 with the eight open tasks; "Chase the vendor for sandbox credentials", three
days late, comes first.

## What to try

- **Without a key**, the same call answers `401`.
- **With Julia's key** (the viewer), create a task — it answers `404` and nothing is written:

  ```bash
  curl -X POST -H "x-api-key: $VIEWER_KEY" -H "content-type: application/json" \
    -d '{"fields":{"title":"Book the cutover window","priority":"High"}}' \
    localhost:3000/api/tables/tasks/records
  ```

  The same call with Samir's key answers `201`.

- **Mark the overdue task done** with Samir's key, then read its history. The history is
  addressed by the table's id (`tasks` is table `2`):

  ```bash
  curl -X PATCH -H "x-api-key: $TASK_API_KEY" -H "content-type: application/json" \
    -d '{"fields":{"done":true}}' localhost:3000/api/tables/tasks/records/1
  curl -H "x-api-key: $TASK_API_KEY" localhost:3000/api/tables/2/records/1/history
  ```

- **Delete a task** with Samir's key: `404`. Only an admin deletes, and a deleted task goes to
  the trash (`POST /api/tables/tasks/records/:id/restore` brings it back).
- `GET /api/tables` lists both tables for every role; a table that names no reader in its
  `permissions` is left out of it.

## Deploy

The **Deploy on Scalingo** button above provisions the app with a PostgreSQL addon
(Scalingo's filesystem is ephemeral — the database keeps your data across deploys; file
uploads are stored in Postgres too). Secrets are generated automatically; you only fill in
`BASE_URL`. Any other host works the same way: run the `sovrium` binary with this config
(see the [deployment guides](https://sovrium.com/en/docs/installation)).

> **The demo accounts are for trying the app, not for running it.** The seed gives every
> account it creates, the admin included, the one password in `SOVRIUM_SEED_PASSWORD`, and
> their addresses are published in this README. Before anyone else can reach the app, choose
> a long password or skip the seed, and change or delete the demo admin. Sign-up is already
> closed (`allowSignUp: false`), so nobody can add an account of their own.

## About this repository

This repository is **auto-published from the
[Sovrium monorepo](https://github.com/sovrium/sovrium)** on every release
(source: [`templates/api-only`](https://github.com/sovrium/sovrium/tree/main/templates/api-only)).
Issues are welcome here; please send code contributions upstream to the monorepo so the
template stays in sync with the engine. The pinned engine release lives in
`.sovrium-version`.

License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately
([BSL 1.1](https://github.com/sovrium/sovrium/blob/main/LICENSE.md)).
