# Migrating Tables and Records

> Bring the tables and records of Airtable, Notion, Google Sheets, a CSV or XLSX file, Baserow, Retool Database, Webflow CMS, Zapier Tables or Zite across, with what each one maps, degrades and reports.

Every table source follows the two stages of [Migrating From Another Tool](/en/docs/cli-import): each table becomes a `tables[]` entry with a `source_id` field, and its records become seed files in `seed/import/` that `--apply` seeds. A table or field name longer than the 63 characters Sovrium accepts is shortened, ending with a hash of the full name so two long names stay apart; formulas read the new name, and the report gives the full one.

## The sources at a glance

| Source          | How to get it                                                                                     | What maps                                                                                        | What degrades                                                                      | What is reported                                                       |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Airtable        | `airtable:<baseId>`, a personal access token in `AIRTABLE_TOKEN`                                  | every field type with a row, links, lookups, counts, translatable formulas, collaborators, files | rollups and untranslated formulas keep their last values                           | non-grid views, AI and synced fields, automations, Interfaces, scripts |
| Notion          | `notion:<databaseId>`, a connection secret in `NOTION_TOKEN`                                      | properties, relations, people, files, translatable formulas and rollups                          | untranslated formulas and rollups keep their last values                           | places, verifications, buttons, views, page content, automations       |
| Google Sheets   | `sheets:<spreadsheetId>`, an OAuth access token in `GOOGLE_TOKEN`; or a downloaded `.xlsx`/`.csv` | one table per sheet or declared table, typed from values and the sheet's own formats             | formulas keep their last values                                                    | sheets holding a chart or a connected data source                      |
| CSV, XLSX       | the file                                                                                          | one table, each column typed from its values                                                     | a column of mixed values is text                                                   | records keyed by row position when no `id` column is unique            |
| Zapier Tables   | the table's CSV download                                                                          | one table, typed from its values, keyed by Zapier's record id                                    | linked records are kept as their display text                                      | hidden fields and filtered-out records are not in a download           |
| Baserow         | the workspace export ZIP; or `baserow:<URL>#<dbId>` with a database token in `BASEROW_TOKEN`      | every field type with a row, links, lookups, rollups, counts, files, grid views                  | formulas keep their last values (a ZIP holds none, so they stay empty)             | other views; from the API, views and collaborators' emails             |
| Retool Database | `retool-db:$env.RETOOL_DB_URL`, its connection URL in `RETOOL_DB_URL`                             | each PostgreSQL type, primary keys, foreign keys, unique constraints                             | a type it does not list is text                                                    | a table with no primary key is keyed by row position                   |
| Webflow CMS     | `webflow:<siteId>`, a site token with `cms:read` in `WEBFLOW_TOKEN`; or a collection's CSV export | each collection, references, options, images and files                                           | colours lose their transparency; from a CSV, every column is typed from its values | User fields                                                            |
| Zite            | `zite:<databaseId>`, an API key in `ZITE_TOKEN`                                                   | every field type with a row, linked records, lookups, attachments                                | formulas keep their last values                                                    | Zite's system source field, workflows                                  |

Airtable and Notion are detailed in [Migrating From Airtable and Notion](/en/docs/cli-import-airtable-notion); Baserow, Retool Database, Webflow CMS and Zite in [Migrating From Baserow, Retool Database, Webflow CMS and Zite](/en/docs/cli-import-databases). The rest of this page covers the sources with no schema of their own.

A grid view becomes a table view whose id starts with its table's name (`deals_open`). Views, tables and the link tables a many-to-many link creates share one set of names in the database, so a view whose id is already taken, say a view `Clients` on `Deals` and the `deals_clients` link table, is stored as `deals_clients_view` (then `_view_2`, …, cut to 63 characters), and the report names the rename.

## Typing a column from its values

A spreadsheet has no schema, so each column is typed from its values: the narrowest of checkbox, integer, decimal, percentage, currency, date, date-time, time, email, URL and text that every value fits. One value that fits nothing narrower makes the column text; inference never guesses past the evidence. The original column header is kept as the field's `label`. A cell a spreadsheet guarded against formula injection with a leading apostrophe (`'=SUM(A1)`) is read without the apostrophe, as text.

A CSV whose `id` column holds a distinct value on every row is keyed by it, and that column becomes `source_id`. Without one, records are keyed by row position (`row-1`, `row-2`, …), and the report warns that a re-import then matches rows only if they stay in the same order.

## CSV and XLSX

```bash
sovrium import ./contacts.csv --config app.yaml
sovrium import ./contacts.csv --config app.yaml --write --apply
```

A CSV file is one table, named after the file. An XLSX file is read the same way. Export each table of the tool you are leaving as its own file, and convert them one by one.

## Google Sheets

```bash
export GOOGLE_TOKEN=ya29.…
sovrium import fetch sheets:1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
sovrium import .sovrium-imports/sheets-… --config app.yaml --write
```

`sheets:<spreadsheetId>` takes the id from the sheet's link (`docs.google.com/spreadsheets/d/<spreadsheetId>/edit`). `GOOGLE_TOKEN` holds an OAuth access token with the read-only scope `https://www.googleapis.com/auth/spreadsheets.readonly`. One way to get one: open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground), pick **Google Sheets API v4 › spreadsheets.readonly**, authorise with the Google account that can open the sheet (under the settings cog, **Use your own OAuth credentials** takes your own OAuth client), exchange the code for tokens, and copy the access token. It lasts an hour. The fetch sends only `GET` requests, a block of 1,000 rows at a time, and waits a minute when Google answers that the per-minute read quota is spent.

- **One table per sheet**, or one per table a sheet declares. A sheet holding a chart, or connected to an external data source, holds no rows and is reported.
- **Types.** Each column is typed from its values, told what the sheet states: a declared table's column types, a dropdown's options (a value outside the list becomes one more option), date, time, percent and currency formats, and a checkbox. A person chip is read as its email, a link chip as its link.
- **Formulas** keep the value the sheet last computed, and the report names their columns. A cell in error holds nothing.
- **Records are keyed by row position** unless a column headed `id` holds a distinct value on every row, and the report says so. A downloaded `.xlsx` or `.csv` of the sheet converts on its own, with no token.

## Zapier Tables

Zapier Tables has no documented API this version reads, so a table is imported from its CSV download (the table's menu, then **Download**). The download is recognised by its first three columns, `tables_record_id`, `tables_created_at` and `tables_updated_at`.

```bash
sovrium import ./customers.csv --config app.yaml --write
```

- Each record is keyed by `tables_record_id` and keeps its creation time. Columns are typed from their values: `True`/`False` become checkboxes, and dates Zapier writes as `10/01/26` become dates, read month first unless a value shows the day first. The report says which order was read.
- A **linked record** is written as its display text, and a download holds one table, so a linked-record column is kept as that text, not as a link.
- A download holds only the fields and records the table showed: **hidden fields and filtered-out records are not in it**. Show everything before downloading. The report says this for every Zapier Tables import.
