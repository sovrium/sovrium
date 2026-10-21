# Migrate from Notion to Sovrium

> Move a Notion database to a self-hosted Sovrium app with `sovrium import`: fetch it read-only, preview the conversion, read the report, then write and seed its tables, relations, people and files.

You keep a CRM, a project tracker or a content calendar in a Notion database and want it in an app you own. `sovrium import` reads the database once through Notion's API and turns each of its data sources into a Sovrium table, with its rows as seed records.

## Before you start

You need an app to import into. An empty one with accounts is enough, so the people your database names can become accounts:

```yaml
name: projects
version: 1.0.0
auth:
  strategies:
    - type: emailAndPassword
```

In Notion, create an internal connection (or a personal access token) and copy its secret. A connection sees only what is shared with it, so open the database, choose **Connections** in its menu and add yours. To bring people across with their email, give the connection the right to read user information including email addresses. Copy the database id: the 32 characters before `?v=` in the database's link.

## 1. Fetch a snapshot

```bash
export NOTION_TOKEN=ntn_…
sovrium import fetch notion:7d1e2f3a4b5c4d6e8f90a1b2c3d4e5f6 --out .sovrium-imports/projects
```

The fetch reads every row, past Notion's 10,000-row query limit, follows the relations to the data sources they point at, and downloads the files Notion hosts before their links expire. It only reads. A fetch that stops halfway resumes when you run the same command again.

## 2. Preview the migration

```bash
sovrium import .sovrium-imports/projects --config app.yaml
```

The dry run prints the report and writes nothing. The same snapshot always gives the same result, so preview as often as you like.

## 3. Read the report

```text
Tables (2):
  + projects (24 fields, from Projects)
  + clients (4 fields, from Clients)
    simplified projects.notes: rich_text -> long-text — Notion annotations (bold, colour, mentions) are dropped; the plain text is kept
    simplified projects.task_id: unique_id -> autonumber — The id's text prefix is dropped; the number is kept
    as text projects.office: place -> long-text — No Sovrium field type matches notion's "place"; its values are kept as text.
    never importable: Notion database views — Notion's API serves no view: tables, boards, calendars and their filters are not readable.

Records (2 seed files):
  seed/import/projects.yaml: 3 records, keyed by source id
  seed/import/clients.yaml: 27 records, keyed by source id
  seed/import/users.yaml: 1 account, no password, no invitation

Automations (0, every one disabled):
  never importable: Notion automations — Notion exposes database automations through no API, MCP server or export, so they cannot be imported.
```

Relations become relationship fields, select and status keep their options and colours, people become accounts with no password and no invitation, and formulas written with `prop("Name")` are translated when every function they use has a counterpart. A formula or rollup that does not translate keeps its last values and lands in the **TODO** list. The full mapping is in [Migrating From Airtable and Notion](/en/docs/cli-import-airtable-notion).

## 4. Write and seed

```bash
sovrium import .sovrium-imports/projects --config app.yaml --write --apply
sovrium start app.yaml
```

`--write` adds the tables to `app.yaml` and the rows to the gitignored `seed/import/`; `--apply` seeds them. A person the database names claims their account later with a password reset to their email, or an invitation you send. Running the import again changes nothing.

## 5. Rebuild what Notion keeps to itself

- **Automations** cannot be imported: Notion exposes them through no API or export. Recreate each one as a Sovrium automation on the imported table, and switch them on one at a time, checking each run under `/_admin/runs`.
- **Views** are not in Notion's API: rebuild the boards, calendars and filtered tables you used as pages and their data components.
- **Page content**, the blocks inside a row, is not a property and does not come through the API. Export your workspace or a page from Notion as a ZIP and import that file: its pages become new pages in your config.
- **Buttons** are present but unreadable, and **places** and **verifications** are kept as text.
