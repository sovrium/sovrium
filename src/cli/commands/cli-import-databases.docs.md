# Migrating From Baserow, Retool Database, Webflow CMS and Zite

> Bring a Baserow workspace or database, a Retool Database, a Webflow site's CMS collections or a Zite database across, typed from the source's own schema.

Each of these sources follows the two stages of [Migrating From Another Tool](/en/docs/cli-import). The summary of every table source is on [Migrating Tables and Records](/en/docs/cli-import-tables).

## Baserow

The **workspace export ZIP** is the most complete input: in Baserow, open the workspace menu and choose _Export data_, then convert the file. It carries the tables, their views, their rows, the files and the automations, and it is the same for Baserow Cloud and a self-hosted instance.

```bash
sovrium import ./workspace-export.zip --config app.yaml --write
```

- Every field maps through the Baserow table: a link becomes a `relationship`, a file field `multiple-attachments` (its files copied into `seed/import/assets/`), a collaborator field `user`, a date that keeps a time `datetime`, and so on. A lookup, a rollup or a count becomes the Sovrium field of the same kind when the link it reads through was imported. When two tables would compute fields from each other, which Sovrium cannot serve, one of them keeps its values instead, and the report says which.
- **Formulas are not translated** from Baserow. The export also leaves every computed cell empty (Baserow recomputes them when it imports), so a formula becomes a field of its result type, and the TODO list quotes the original. A password field's value is never read.
- A grid view becomes a table view with its visible fields and sorts; every other view is reported.
- The workflows in the export become disabled automations, described in [Migrating Automations](/en/docs/cli-import-automations).
- Workspace members, roles, webhooks, dashboards and application builder pages are not in an export, and the report lists them as never importable.

`sovrium import fetch baserow:https://api.baserow.io#<database id>` reads one database through the REST API instead, with a **database token**, which you create in Baserow's settings. Name a self-hosted instance by its URL, over `https` (plain `http` is accepted for a loopback host only); a URL holding a user name, a password or a query is refused. A database token cannot read views or automations, and names collaborators without their email, so those are reported as never importable; computed values, on the other hand, come back filled, so a formula keeps its last values.

## Retool Database

A Retool Database is a PostgreSQL database, and Retool shows its connection URL to the organization's admins. Put that URL in the environment, never on the command line:

```bash
export RETOOL_DB_URL='postgresql://…'
sovrium import fetch 'retool-db:$env.RETOOL_DB_URL'
```

- The URI names the variable, and the snapshot records that name, never the URL. A URI holding a URL is refused without repeating it.
- `fetch` opens one connection, inside one read-only transaction that is rolled back at the end, so nothing it sends can write. It reads the tables, columns, primary keys, foreign keys and unique constraints from `information_schema`, then every table's rows, 1,000 at a time. It never runs `pg_dump`.
- Each PostgreSQL type maps through the Retool Database table (`integer`, `numeric`, `boolean`, `date`, `timestamp with time zone`, `jsonb`, arrays, …); a type it does not list is kept as text.
- A one-column primary key keys the records and becomes `source_id`; a one-column foreign key becomes a `relationship` to the table it references; a one-column `UNIQUE` constraint is kept as `unique`. A table with no primary key is keyed by row position.

A Retool workflow converts from its **Export to JSON** file: see [Migrating Automations](/en/docs/cli-import-automations).

## Webflow CMS

`webflow:<siteId>` reads every CMS collection of the site through Webflow's Data API v2, with a site token, created in the site's settings, that has the `cms:read` scope. The same fetch reads the site's forms and form webhooks when the token allows it: see [Migrating Forms](/en/docs/cli-import-forms) and [Migrating Automations](/en/docs/cli-import-automations).

```bash
export WEBFLOW_TOKEN=…
sovrium import fetch webflow:580e63e98c9a982ac9b8b741
sovrium import .sovrium-imports/webflow-… --config app.yaml --write
```

It sends only `GET` requests, at most one a second (Webflow allows 60 a minute on its cheapest site plans), and waits out a `429` for as long as its `Retry-After` asks. Each collection becomes a table, with every item of the site's primary locale, drafts and archived items included.

- **Reference** and **Multi-reference** fields become `relationship` fields to the collection they point at. One pointing at a collection that was not imported is kept as text, and the report says so. **Option** fields become single selects holding the option's name.
- **Image**, **Multi-image** and **File** fields become attachment fields. Every file is downloaded during the fetch: Webflow's links last only as long as the site does.
- **Color** fields hold `#rrggbb`: a colour written another way is converted, a transparency is dropped, and the report names each value it changed or left out.
- A **User** field names a Webflow site member, who has no account here, so it is kept as text and reported.
- **Offline fallback:** a collection's CSV export (it carries `Item ID` and `Collection ID` columns) is read without the API. The file holds no field types, so every column is typed from its values like any CSV, and references are kept as text. The report says both.

A Webflow site export ZIP holds pages, not collections: its pages are converted into new pages, and its forms into forms (see [Migrating Pages](/en/docs/cli-import-pages)). The site's CMS collections, forms and form webhooks import through `webflow:<siteId>` as above.

## Zite

`zite:<databaseId>` reads one Zite database through the Zite Database API, with an API key from Zite's developer settings. Zite issues only full-access keys, so the fetch never relies on the key to stay read-only: it reads the tables, their fields and their records, and nothing else. It lists records with Zite's records query, a `POST` that only reads, 2,000 at a time, and stays under Zite's 30 requests a second.

```bash
export ZITE_TOKEN=…
sovrium import fetch zite:db_northwind_ops
```

- Fields go through Zite's own row of the mapping table. A **linked record** field becomes a `relationship` to the table it points at, a **lookup** reads through it, and **attachments** are downloaded during the fetch. A link Zite does not let the fetch download is counted as skipped, and the record keeps the file's name.
- **Formulas** keep their last computed values, and the report quotes each expression in a TODO. A type with no row, such as Zite's system **source** field, is kept as long text and reported.
- Zite workflows are code in the app's repository, not database content, so the report lists them as not importable.
