# Migrating From Airtable and Notion

> Fetch an Airtable base or a Notion database read-only, then convert it offline into typed tables, links, formulas and seed files, with what each tool keeps to itself.

Both tools carry a real schema, so their fields keep their types instead of being typed from their values. Each follows the two stages of [Migrating From Another Tool](/en/docs/cli-import); the other table sources are on [Migrating Tables and Records](/en/docs/cli-import-tables).

## Airtable

```bash
export AIRTABLE_TOKEN=pat…
sovrium import fetch airtable:appX9kQ2vLmN7
sovrium import .sovrium-imports/airtable-… --config app.yaml
```

`airtable:<baseId>` takes the id that starts with `app` in the base's link. Create a personal access token in Airtable's Builder Hub with the `data.records:read` and `schema.bases:read` scopes and access to the base; add `workspacesAndBases:read` when the base has a form view. The fetch reads the schema, every record of every table and the attachments, sending only `GET` requests.

Each field goes through Airtable's own row of the mapping table. A type with no row (AI text, a synced field) is kept as long text and reported.

- **Links** become `relationship` fields. Whether a link holds one record or several is what Airtable declares, so a link allowing several stays a link to several before any record holds two; a link declared to one record that a record fills with several anyway is read as several, so no link is lost. Every imported link is optional, so links that loop through three tables still validate. A two-way link is one relationship read from both sides: the side holding one record stores it (`many-to-one`), its partner reads it back (`one-to-many`), and two sides holding several are a `many-to-many`. A link to a record the snapshot does not hold is left out.
- **Lookups and counts** read through the imported link, and a formula reading a lookup through a link to one record knows the type Airtable declares for it. Sovrium refuses two tables whose computed fields read each other through one link; when a base has such a pair, the field of the later table keeps its last values and the report says why.
- **Rollups** keep their last values: Airtable does not expose how a rollup aggregates, so the report holds a TODO naming the field and the link it read through.
- **Formulas** are translated into Sovrium formulas when every function and field they use has a counterpart. One that does not translate keeps its last values, as a field of the formula's result type, and the report holds a TODO quoting the formula with its field names. `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND` and `DATETIME_FORMAT` translate when they read a date or date-and-time field directly, in UTC as Airtable computes them, and `DATETIME_FORMAT` when its format is written out with `YYYY`, `YY`, `MMMM`, `MMM`, `MM`, `M`, `DD`, `D`, `HH`, `H`, `mm` and `ss`. `RECORD_ID()` reads the `source_id` field, so a record created after the import has no Airtable id there. `DATETIME_DIFF` between two date fields and `DATEADD` translate when their unit is days or weeks, `WEEKDAY` and a two-argument `FIND` translate too, all through formulas that read the same on SQLite and PostgreSQL. A difference or a shift in months or years, `WEEKNUM` (Airtable does not number weeks the ISO 8601 way), a difference between two date-and-time fields (Airtable counts elapsed time, Sovrium calendar days) and `FIND` with a start position keep their values.
- **Select options** keep their order and their colour. A choice with no name is dropped and its records left empty, a name declared twice is kept once, and a select with no choice at all becomes a text field; the report names each. **Percentages** are written as `40` for Airtable's `0.4`. **Rich text** is converted from Airtable's Markdown to the HTML a rich-text field keeps. A **button** keeps its link only when every record opens the same one; otherwise each record's link is kept as text.
- **Created and modified times** become the matching system fields. The creation time comes from the source record; a last-modified time restarts at the import, and a created-by field names the account that ran the seed. The report says both.
- **Collaborators** become `user` fields and `unclaimed` accounts, as described on [Migrating From Another Tool](/en/docs/cli-import). In an app with no `auth` block, collaborators and the authors a created-by or last-modified-by field recorded are kept as their email addresses.
- **Attachments** are downloaded during the fetch, because Airtable's links expire after two hours, and copied into `seed/import/assets/`.
- **Grid views** become table views of the same name. The API this version reads gives no view's filters, sorts or field list. Kanban, calendar, gallery, form, timeline and Gantt views are reported.

**Reported, not imported.** Automations and Interfaces are not in Airtable's Web API: the report lists them as readable through the Airtable MCP server and not imported. Scripts are reported too: no documented API exposes them. Rebuild the automations with [Migrating Automations](/en/docs/cli-import-automations) in mind: a Sovrium automation on the imported table is usually a `record` trigger and a few steps.

## Notion

```bash
export NOTION_TOKEN=ntn_…
sovrium import fetch notion:7d1e2f3a4b5c4d6e8f90a1b2c3d4e5f6
sovrium import .sovrium-imports/notion-… --config app.yaml --write
```

`notion:<databaseId>` takes the 32-character id from the database's link (`notion.so/…/<databaseId>?v=…`). The token is an internal connection's secret, or a personal access token; the connection sees only the pages and databases shared with it, so share the database with it first. Notion shares people's email addresses only when the connection may read user information including email. The fetch speaks API version `2025-09-03`, sends `GET` requests plus the read-only `POST …/query` Notion answers rows on, and waits out a rate limit for as long as its `Retry-After` asks.

- **One table per data source.** A database holding several data sources becomes several tables. The data sources its relations point at are fetched too, so a link lands on an imported table; one the connection cannot see is left out, and its links are kept as text.
- **Every row is read.** A Notion query stops at 10,000 rows, so the fetch reads rows by creation time and starts a new window where the cap cut it. A relation holding more than 25 links, and the formulas and rollups of its row, are read in full, one row at a time.
- **Files** Notion hosts are downloaded during the fetch, because their links expire after an hour. A file linked from another site is not downloaded.
- **Types.** Each property goes through Notion's row of the mapping table. A relation becomes a `relationship`, a two-way relation one relationship read from both sides. People become `user` fields and `unclaimed` accounts, as for Airtable; a person whose email Notion did not share is left out. Select, multi-select and status keep their options and colours. A unique id becomes an `autonumber` without its prefix. A date keeps the start of a range, and a date holding a time becomes a `datetime`.
- **Formulas** are translated from Notion's `prop("Name")` syntax when every function and property they use has a counterpart, `year()`, `month()` and `date()` over a date property without a time among them; **rollups** keep their aggregation when Sovrium has it. One that does not translate keeps its last values and the report holds a TODO quoting it.
- **Rich text** keeps its plain text: bold, colour and mentions are dropped. Created and last-edited times and authors become the matching system fields, as for Airtable.

**Reported, not imported.** A place and a verification are kept as text. A button is present but not readable: the API exposes neither its actions nor a way to press it. Views and page content are not in the API. Notion automations cannot be imported at all, through any API or export. Page content comes from a file instead: import a Notion workspace or page export ZIP, and its pages become new pages in your config.
