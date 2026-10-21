# Migrate from Airtable to Sovrium

> Move an Airtable base to a self-hosted Sovrium app with `sovrium import`: fetch the base read-only, preview the conversion, read the report, then write and seed the tables, links, formulas, files and collaborators.

You have an Airtable base and want to own it: self-hosted, config-as-code, no per-seat pricing. `sovrium import` reads the base once, read-only, and turns it into Sovrium tables and seed files. You can repeat the conversion as often as you like before you switch over.

## Before you start

You need an app to import into. An empty one is enough:

```yaml
name: crm
version: 1.0.0
auth:
  strategies:
    - type: emailAndPassword
```

The `auth` block matters for collaborator fields: with it, each collaborator becomes an account the person can claim later; without it, collaborators are kept as email addresses.

Then create a personal access token in Airtable's Builder Hub, with the `data.records:read` and `schema.bases:read` scopes and access to the base (add `workspacesAndBases:read` if the base has a form view). Copy the base id, the part of the base's link that starts with `app`.

## 1. Fetch a snapshot

```bash
export AIRTABLE_TOKEN=pat…
sovrium import fetch airtable:appX9kQ2vLmN7 --out .sovrium-imports/crm
```

The fetch reads the schema, every record and every attachment, sending only read requests, and writes them to a folder you keep. The token stays in your environment: it is never written to the snapshot, the config or the output. A large base that stops halfway resumes when you run the same command again.

## 2. Preview the migration

```bash
sovrium import .sovrium-imports/crm --config app.yaml
```

A dry run is the default: it prints the report and writes nothing. Run it as often as you like; the same snapshot always gives the same result.

## 3. Read the report

The report says what was created and what did not come across as it was. A typical base reads like this:

```text
Tables (2):
  + projects (28 fields, from Projects)
  + clients (9 fields, from Clients)
    simplified clients.total_budget: rollup -> currency — Kept as its last computed values: Airtable's API does not expose a rollup's aggregation, so it cannot be rebuilt
    view projects / Kanban (kanban): not converted, only a grid view becomes a table view
    never importable: Airtable Interfaces — Airtable's Web API does not expose interface pages; they are readable through the Airtable MCP server, not yet imported.

Records (2 seed files):
  seed/import/projects.yaml: 3 records, keyed by source id
  seed/import/clients.yaml: 3 records, keyed by source id

TODO (1):
  tables.clients.fields.total_budget: Airtable's API does not expose a rollup's aggregation, so it cannot be rebuilt
      rollup(Projects, budget)
```

Most fields keep their type: links become relationships, lookups and counts read through them, select options keep their order and colour, and formulas are translated when every function they use has a Sovrium counterpart. A formula or a rollup that does not translate keeps its last values and lands in the **TODO** list, quoted as Airtable wrote it. The full mapping is in [Migrating From Airtable and Notion](/en/docs/cli-import-airtable-notion).

## 4. Write and seed

```bash
sovrium import .sovrium-imports/crm --config app.yaml --write --apply
```

`--write` adds the tables to `app.yaml` (or writes one sidecar file per table beside a TypeScript config) and the records to `seed/import/`, which holds your real data and is added to `.gitignore`. `--apply` then seeds them. Running the same command again changes nothing. On the day you switch over, fetch a fresh snapshot into a new folder (a folder that already holds a finished snapshot keeps it) and convert that one: rows merge on the Airtable record id, so new records are added and changed ones updated.

```bash
sovrium start app.yaml
```

Open `/_admin/records` to check the tables and their records.

## 5. Rebuild the automations

Airtable's Web API does not expose automations, Interfaces or scripts, so the import cannot bring them across: the report lists them as readable through the Airtable MCP server, not imported. Rebuild each automation as a Sovrium automation on the imported table, usually a `record` trigger and a few steps, and switch them on one at a time, checking each run under `/_admin/runs`. If an n8n or Make workflow fed the base, import it with [Migrating Automations](/en/docs/cli-import-automations): its Airtable steps become record steps on the imported tables.

## What does not come across

- **Views**: a grid view becomes a table view of the same name; kanban, calendar, gallery, form, timeline and Gantt views are reported. Rebuild them as pages and their data components.
- **Rollups**: Airtable's API does not say how a rollup aggregates, so each keeps its last values. Replace it with a Sovrium rollup field from the TODO list.
- **AI text and synced fields** are kept as long text.
