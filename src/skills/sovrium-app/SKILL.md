---
name: sovrium-app
description: Use when creating, editing, debugging or reviewing a Sovrium app — an app.yaml, app.yml or app.ts config and its $ref partials, interpreted by the sovrium binary — or when the user mentions sovrium validate, sovrium start --watch, sovrium docs, the sovrium config MCP, a Sovrium page that looks wrong, or an API answer that surprises them. Also use to decide which specialist Sovrium skill (data model, pages, automations, SEO) a request belongs to.
license: BSL-1.1
compatibility: Needs the sovrium binary on PATH or the sovrium config MCP; a browser MCP (Playwright MCP, Chrome DevTools MCP or Claude in Chrome) is optional but recommended
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium app: the core loop

A bare agent edits a Sovrium config as if it were application code or a generic YAML file. It guesses option names from other products, renumbers field ids, inlines secrets, declares success after the file parses, and never looks at the running app. Sovrium is an interpreter: the config IS the app, the running binary is the only authority on what the config means, and the only proof that an edit worked is the app you can open and call.

## What you are editing

- **One config file** at the project root: `app.yaml`, `app.yml` or `app.ts`. Sovrium reads it and generates the database, the API, the pages and the operator console. Read `sovrium docs configuration/configuration-files`.
- **`$ref` partials**: large configs split into files under `config/` that the root references with `$ref`. Edit the partial that owns the thing you change, never a copy of it. Read `sovrium docs configuration/configuration-refs`.
- **A typed `app.ts`**: `sovrium types` writes `sovrium.d.ts` and `tsconfig.json` so an editor type-checks the config with no install. Read `sovrium docs configuration/configuration-typescript`.
- **Never** the database, the generated HTML, or the operator console at `/_admin`. The console reads data; it never edits configuration.

## Where the truth is, in order

The running binary wins over anything you remember about Sovrium. Look things up in this order and stop at the first answer:

1. `sovrium docs` — the table of contents of the manual shipped inside this binary.
2. `sovrium docs search <words>` — finds the article that covers a topic.
3. `sovrium docs config <path>` — one option, written the way the config writes it: `llms.full`, `tables[].fields[].type`, `pages[].meta.title`. It names the article that documents it.
4. `sovrium schema` — the whole JSON Schema, when you need every accepted key at once.

If your client cannot run commands (Claude Desktop over the config MCP), `sovrium:<app>_config_schema` answers the same dotted paths. For prose it cannot give, read `https://sovrium.com/llms.txt` and the `.md` twin of an article, but first compare the site's version with the one the MCP server reports: the site documents the latest release, not necessarily the one you run.

## Two ways to edit

**Files** (Claude Code, Cursor, Codex, any editor): edit the file, then validate. This is the default.

**The config MCP** (Claude Desktop and other MCP clients): `sovrium mcp --project <dir>`. It is read-only until the client's environment sets `MCP_CONFIG_WRITE=1` and the project directory is named. Then write in this order, one file at a time:

1. `sovrium:<app>_config_list_files` → paths and `sha256` digests.
2. `sovrium:<app>_config_read_file` → the whole file and its `sha256`.
3. `sovrium:<app>_config_write_file` → the WHOLE new file, with `expectedSha` set to the digest you read.
4. `sovrium:<app>_config_validate` → confirm, then check `sovrium:<app>_config_status`.
5. `sovrium:<app>_config_undo` → only when the operator wants the last edit back.

The MCP writes `.yaml`, `.yml` and `.json` only; an `app.ts` config is edited as a file. Details and refusal cases: `references/config-mcp.md`.

## The loop

Copy this checklist into your working notes and tick it as you go.

```
- [ ] 1  Read: the config files you will touch, and the manual article for each option you will use
- [ ] 2  Plan the smallest change; write the plan down first when it touches tables, automations or auth
- [ ] 3  Edit
- [ ] 4  sovrium validate  (add --json for machine-readable findings); fix until valid
- [ ] 5  Keep sovrium start --watch running; read what it printed (hot swap or restart)
- [ ] 6  ONE browser pass on the URL it printed (references/browser-loop.md)
- [ ] 7  API check on every table you touched (references/api-checks.md)
- [ ] 8  Fix everything the passes found, in one batch; back to step 4
- [ ] 9  At most one confirmation pass (steps 6–7 again); then stop
- [ ] 10 Report evidence: screenshot path, console excerpt, the API status and body
```

Step 5 in detail: `sovrium start --watch` reloads on save. A change under `tables`, `automations`, `auth`, `agents`, `connections`, `env`, `analytics` or `buckets` forces a full restart (a new port may be bound — re-read the printed URL); everything else is swapped in place. A restart that would drop data is refused and the server keeps the configuration it already serves; read the reason it prints before you retry.

Step 6 in one line, with a browser MCP (Playwright MCP or Claude in Chrome): navigate → wait for the network to settle → accessibility snapshot for structure → screenshot only when appearance is the question → console errors filtered by pattern and failed network requests → resize to desktop, tablet, mobile. No browser MCP? `curl` the HTML, or write a short Playwright script (`references/browser-loop.md`).

Step 7 in one line: `GET /api/tables/<table>/records` for each table you touched, as the role that should see it and as one that should not. `/api/openapi.json` lists every route, but only to an admin of an app with `auth`.

## Invariants

- **Explicit field `id`s, always.** An omitted id is the field's position, so inserting a field above it re-points the data behind every later field. Never reuse, renumber or delete-and-recreate an id; a field keeps its data across a rename only because its `id` stays.
- **Secrets live in the environment.** Write `$env.NAME` in the config, declare `NAME` in its top-level `env` block (an undeclared one refuses to boot and to validate), and put the value in `.env`; `sovrium secret generate` prints fresh auth and encryption secrets. Never a key, token or password inline, in a record, or in a commit.
- **A denied read answers 404, and that is correct.** Sovrium answers 404, never 403, to a caller who may not see a record, a table or a route. Do not "fix" it; test it.
- **A table with no `permissions` block stays open to every non-viewer role.** Declaring any one operation denies every operation you leave out to non-admins. Decide which you mean (`sovrium docs tables/table-permissions`).
- **`/_admin` never edits configuration.** It shows data and runs; configuration changes happen in the file.
- **Never edit configuration through a browser.** The browser is for looking; the file is for changing.
- **Destructive schema changes are opt-in.** Dropping a column needs `allowDestructive: true` on the table and the operator's explicit agreement.
- **These skill files are plain files.** `sovrium skills` refuses to write through a symlink at a skill folder, a file inside one or its `.sovrium-skills.json`; only the `.claude/skills` folder itself may be a link, and only to somewhere inside the project.

## Which skill next

| The request is about                                                 | Use                   |
| -------------------------------------------------------------------- | --------------------- |
| Tables, fields, relations, permissions, seed data, migrations        | `sovrium-data-model`  |
| Pages, components, layout, design tokens, copy, forms                | `sovrium-pages`       |
| Automations, triggers, actions, connections, webhooks, notifications | `sovrium-automations` |
| Search engines, social previews, AI visibility, sitemaps, `llms.txt` | `sovrium-seo-geo`     |

Keep this skill's loop running underneath whichever specialist you load.

## When stuck

- `sovrium docs get-started/troubleshooting` and `sovrium docs get-started/troubleshooting-runtime`.
- `sovrium validate --json`: every finding carries a `path`, a `message` and, for a closed list, the `accepted` values.
- `sovrium docs cli-api/cli-validate` explains what validation does and does not check.
- Two failed attempts at the same fix: stop, re-read the article, and say what you tried.

## References

- [references/browser-loop.md](references/browser-loop.md) — read before step 6: the bounded browser pass, the tool alias table for three browser MCPs, the viewport matrix, and the no-browser fallbacks.
- [references/api-checks.md](references/api-checks.md) — read before step 7: record endpoints and their expected status codes, how to authenticate, `curl` templates.
- [references/config-mcp.md](references/config-mcp.md) — read when editing over MCP instead of files: every tool, the write order, what a write is refused for.
- [references/cli-verbs.generated.md](references/cli-verbs.generated.md) — read when you need the exact verbs and flags of the binary you run; generated from it.
- [references/sources.md](references/sources.md) — where the practices in this skill come from.
