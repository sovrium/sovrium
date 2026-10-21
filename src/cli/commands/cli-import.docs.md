# Migrating From Another Tool

> Move tables, records, automations and forms out of Airtable, Notion, a spreadsheet, n8n, Make, Typeform and a dozen other tools, with one read-only fetch and one offline conversion you can preview and repeat.

`sovrium import` turns an app you built in another tool into Sovrium configuration and seed files. It works in two stages, so the network is on one side of a folder and nothing is on the other.

```text
Usage: sovrium import fetch <source-uri> [--out <dir>] [--token-env <VAR>] [--only <parts>] [--skip-attachments]
       sovrium import <snapshot | file> [--config <file>] [--from <tool>] [--only <parts>]
                      [--dry-run | --write] [--apply] [--prefix <p>] [--json] [--report <file>]
```

A migration is the same five moves whatever the tool: fetch a snapshot, preview the conversion, read the report, write and seed, then switch the automations on one at a time.

```bash
export AIRTABLE_TOKEN=pat…
sovrium import fetch airtable:appX9kQ2vLmN7 --out .sovrium-imports/crm
sovrium import .sovrium-imports/crm --config app.yaml                  # preview
sovrium import .sovrium-imports/crm --config app.yaml --write --apply  # write, then seed
```

## Which page for which tool

| Tool                                                                | What it brings            | Page                                                                                             |
| ------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| CSV, XLSX, Google Sheets, Zapier Tables                             | tables and records        | [Migrating Tables and Records](/en/docs/cli-import-tables)                                       |
| Airtable, Notion                                                    | tables, records, links    | [Migrating From Airtable and Notion](/en/docs/cli-import-airtable-notion)                        |
| Baserow, Retool Database, Webflow CMS, Zite                         | tables, records, links    | [Migrating From Baserow, Retool Database, Webflow CMS and Zite](/en/docs/cli-import-databases)   |
| n8n, Make, Zapier, Retool Workflows, Baserow, Webflow form webhooks | automations               | [Migrating Automations](/en/docs/cli-import-automations)                                         |
| Typeform, Tally, Fillout, Webflow forms                             | forms and their responses | [Migrating Forms](/en/docs/cli-import-forms)                                                     |
| Jotform, Google Forms, Microsoft Forms                              | forms and their responses | [Migrating Forms From Jotform, Google Forms and Microsoft Forms](/en/docs/cli-import-forms-more) |

## Stage one: fetch a snapshot

`fetch` reads the tool's API, read-only, and writes a snapshot folder. It is the only step that touches the network.

| Source URI                      | Reads                              | Token from                |
| ------------------------------- | ---------------------------------- | ------------------------- |
| `airtable:<baseId>`             | an Airtable base                   | `AIRTABLE_TOKEN`          |
| `notion:<databaseId>`           | a Notion database                  | `NOTION_TOKEN`            |
| `sheets:<spreadsheetId>`        | a Google spreadsheet               | `GOOGLE_TOKEN`            |
| `baserow:<instance URL>#<dbId>` | a Baserow database                 | `BASEROW_TOKEN`           |
| `retool-db:$env.RETOOL_DB_URL`  | a Retool Database                  | `RETOOL_DB_URL` (its URL) |
| `webflow:<siteId>`              | Webflow CMS, forms, form webhooks  | `WEBFLOW_TOKEN`           |
| `zite:<databaseId>`             | a Zite database                    | `ZITE_TOKEN`              |
| `n8n:<instance URL>`            | the workflows of an n8n instance   | `N8N_API_KEY`             |
| `make:<zone>/<teamId>`          | the scenarios of a Make team       | `MAKE_TOKEN`              |
| `typeform:[<host>/]<formId>`    | a Typeform form and its responses  | `TYPEFORM_TOKEN`          |
| `tally:<formId>`                | a Tally form and its submissions   | `TALLY_TOKEN`             |
| `fillout:[eu/]<formId>`         | a Fillout form and its submissions | `FILLOUT_TOKEN`           |
| `jotform:[eu/\|hipaa/]<formId>` | a Jotform form and its submissions | `JOTFORM_API_KEY`         |
| `gforms:<formId>`               | a Google form and its responses    | `GOOGLE_TOKEN`            |

Each source's page says how to get its token and which permissions it needs. A source URI the fetch does not know is refused with the list of schemes, and an export file is refused with the conversion command to run instead.

- **The token is read from the environment, and nowhere else.** `--token-env <VAR>` names another variable. There is no `--token` flag: one typed on the command line is refused, and the refusal never repeats it. The token is never written to the snapshot, your config, a seed file, the report or a line of output.
- **The fetch only reads.** It sends `GET` requests, plus the read-only queries Notion and Zite answer rows on with `POST`, whatever the token would allow.
- **The snapshot is a folder you can keep.** By default it is `.sovrium-imports/<tool>-<timestamp>/`, which `fetch` adds to `.gitignore`. `--out` puts it elsewhere, but never inside your instance's data directory (`.sovrium/`) nor inside a folder it serves its static files from (`public/`, or `SOVRIUM_PUBLIC_DIR`). It holds `snapshot.json` (the tool, its API version, when, the export kind, a SHA-256 per file), `raw/` (what the API returned, page by page, untouched, plus the fetch's own index of the attachments it downloaded) and `assets/` (attachments, named by the SHA-256 of their bytes and downloaded during the fetch because their links expire).
- **A large source resumes.** `snapshot.json` is rewritten after every page with the cursor of the next one. If a fetch stops (a rate limit, a dropped connection), it says so and keeps what it read: run the same command into the same folder and it continues where it stopped. A folder that already holds a finished snapshot keeps it: to take a fresh one, fetch into a new folder. Each request has a timeout, transient failures are retried, and a `429` is waited out, for `Retry-After` when the tool sends one and the tool's documented lockout otherwise.
- `--skip-attachments` downloads no file and counts each attachment as skipped; `--only tables` reads the schema and no record.

A conversion refuses a snapshot whose fetch did not finish, or whose files no longer hash to what `snapshot.json` recorded.

## Stage two: convert, offline

```bash
sovrium import ./contacts.csv --config app.yaml                  # preview
sovrium import ./contacts.csv --config app.yaml --write          # write
sovrium import ./contacts.csv --config app.yaml --write --apply  # write, then seed
```

The conversion reads a snapshot written by `fetch`, or an export file the tool gave you: a CSV or XLSX file, a Zapier Tables or Webflow collection CSV, an n8n workflow export, a Make scenario blueprint, a Zapier Zap export (`Zapfile.json`, its ZIP, or a folder of one-Zap files), a Retool workflow's Export to JSON file, a Baserow workspace export ZIP, a Typeform, Tally, Fillout or Google Forms form definition, or a Microsoft Forms responses workbook. It reads that input and nothing else, with no AI, so the same input always produces the same bytes. Rehearse the migration as often as you like, then run it for real from the same input.

- **A dry run is the default.** It prints the report and writes nothing. `--write` writes; `--write` or `--apply` with `--dry-run` is refused.
- **The tool is detected** from the input's shape. An input that matches no tool, or two, is refused with the list of `--from` values; `--from <tool>` settles it.
- **Nothing is overwritten.** A table, form or automation whose name your config already holds is refused, naming it. `--prefix <p>` imports under new names: one value, spelled for each target, so `--prefix crm_` gives the table `crm_contacts` and the automation `crm-weekly-digest`. A re-run that would write exactly what your config already holds is not a clash: it changes nothing.
- **The migrated app is validated first.** Your config with every new entry in place is checked once, before any file is written, and refused with the same finding `sovrium validate` would print.
- **A TypeScript config is never edited.** `--write` writes one sidecar per entry (`tables/<name>.table.json`, `automations/<name>.automation.json`, …) and prints the import lines to add.
- `--only tables,data,automations,forms` restricts what is converted. `--only data` writes the seed files and leaves the config untouched.

## What lands where

- **Tables** become `tables[]` entries, each field typed through its tool's row of the mapping table or, for a source with no schema, from its values. Every imported table gains a `source_id` field, `unique`, holding the source record's id. A column already named `source_id` is renamed `source_source_id`, and the report says so. So is a column named after one Sovrium writes itself (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`), which becomes `source_<name>`, unless it is the matching authorship field of an app with accounts.
- **Records** go to `seed/import/<table>.yaml`, or `seed/import/<table>.jsonl` above 5,000 records. `seed/import/` holds your real data, so `import` adds it to `.gitignore`. A record's seed key is its source id, so a link is written `@<table>.<id>` (a list of them for a link holding several records) and resolves through the seed's own reference pass.
- **Attachments** are copied byte for byte from the snapshot into `seed/import/assets/<sha256>/<filename>` and written `@asset:<sha256>/<filename>`, so the seeded row shows the file under the name the source gave it.
- **Collaborators** become `user` fields, written `@user:<email>`, and each one becomes an `unclaimed` account in `seed/import/users.yaml`: no password, no invitation, nothing sent. The account carries the name the source gives that person, or the part of the email before the `@` when the source gives none. Its owner claims it later with a password reset to that email, or through an invitation you send. An app with no `auth` block has no accounts to link, so collaborators are kept as their email addresses.
- **A record keeps what its source gave it.** Its creation instant is written as the seed record's `created_at`, so the row, and every `created-at` field of its table, reads when the record was really created rather than when it was imported. An autonumber keeps the number the source gave each record, so "project 2" still names the same project, and a row created afterwards is numbered after the highest imported one.
- **Automations** become `automations[]` entries, **every one disabled**: nothing runs until you have reviewed it, set what it needs and switched it on. An n8n Edit Fields (Set) node and a Make Set variable or Set multiple variables module become a `data` `set` step with `fields`, one per name, and a later step reads each as `{{<step>.result.<name>}}`. A typed n8n value (a number, a boolean, a list, an object) stays typed; a name a template cannot read back is written in snake case, and every reference to it follows; an n8n dotted name (`address.city`) nests under its first segment. n8n's "include other input fields" has no equivalent, and the report says so.
- **Forms** become `forms[]` entries, each writing to a table of its own, `<form>_responses`, whose records are the form's past responses.

## Addresses that are credentials

A URL that is itself a credential is never written to the config, which you usually commit. That covers a URL holding a user name or a password, one whose query carries a `token`, `key`, `secret`, `sig`, `signature`, `api_key`, `apikey` or `access_token`, and an inbound webhook address of Zapier, Make, Slack or n8n. The step that called it reads it from `$env.<NAME>` instead, the import declares that NAME in `env[]`, and the report lists it under the env to set, quoting only the host. Set the variable before you switch the automation on.

A credential header is never copied either: `Authorization`, `Cookie`, or one whose name says it holds an API key, a token, a secret, a password or a signature, such as `X-API-Key` or `X-Auth-Token`. A step the import cannot map is quoted in its stub and in the report with each expression as the tool wrote it, and every credential the step held (such a header, a password, an API key, a `Bearer` token, a credential address) reads `[credential removed]`. The same goes for the original code a converted code step keeps as comments: a string assigned to a credential name, a `Bearer` or `Basic` value, a key with a known prefix, a JSON Web Token, a long random string and a credential in an address each read `[credential removed]`, the rest of the code stays as written, and the report says how many values were removed, never what they were.

## Seeding what was imported

`--apply` seeds the imported files right after writing them. It is the same as running:

```bash
sovrium seed --dir seed/import --mode upsert
```

Because every imported table merges on `source_id`, running it again, or re-running `import --write --apply` on the same input, changes no row: a row already holding every value its record writes is left alone and reported as unchanged, its attachments and its collaborators included, and its files are not stored again. Seeding starts no automation and sends no webhook.

A plain `sovrium seed` reads `seed/` and `seed/import/` together, as one set. A table with a seed file in both is refused, naming both files. A `.jsonl` seed file starts with a header line, `{"format":"sovrium.seed","version":1,"mergeOn":["source_id"]}`, followed by one record per line in the same shape as a YAML record; a refused line is named by its number. `sovrium bundle` never packs `seed/import/`.

## The report

Every run prints a report, with or without `--write`:

- **Tables, Records, Automations and Forms**: what is created, each field mapped with a loss and why, the seed files and their record counts, the env variables to set, and what the tool keeps out of reach.
- **Simplified or left out**: every value kept in a simpler shape than the source had, such as a field kept as text, and every part dropped because it does nothing in Sovrium, such as an n8n No Operation node.
- **TODO**: each step, expression, formula or rule that did not translate, quoted as the source wrote it, with where it landed in your config.

`--json` prints it as one JSON document (`sovrium.import-report`, version 1); `--report <file>` saves it. Hand the TODO list to your own AI, or work through it yourself.

## What never imports

Some things live where no API or export reaches, and the report names each one rather than guessing it: Airtable automations and Interfaces (readable through the Airtable MCP server, not imported), Airtable scripts, Notion automations, Webflow Logic, and the passwords and credentials every tool keeps to itself. A Notion workspace or page export ZIP is converted: its pages become new pages in your config, and the forms they hold join the forms part. A Webflow site export ZIP, and the ToolScript ZIP a Retool classic app exports from Retool Cloud or a self-hosted Retool at 3.6.0 or later (`--from retool-classic`), are converted into new pages too, and a Webflow export's forms join the forms part (see [Migrating Pages](/en/docs/cli-import-pages)). A Retool JSON app export is refused, since Retool does not document it, and so is a Retool export from before ToolScript, which holds no `main.rsx`. `--from airtable-interfaces` is refused too: Airtable Interfaces have no file export, so their import stays deferred. Webflow CMS collections, forms and form webhooks, Retool Database and Retool Workflows import as described above.

Nothing in `import` runs over HTTP, in `/_admin` or in the desktop app: it is a command you run once per migration.
