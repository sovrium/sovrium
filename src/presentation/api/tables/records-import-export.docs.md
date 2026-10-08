# Records Import and Export

> Moving bulk data in and out of a table three ways — a CSV wizard in the grid, an export endpoint, and spreadsheet clipboard — all of them ordinary Records writes underneath.

Import and clipboard need no configuration: a `table` bound to a writable table draws the Import control itself. Export is a toolbar affordance, so it appears only where the component asks for it.

```yaml
type: table
dataSource:
  table: orders
toolbar:
  export: true
```

## CSV import

Import is a **wizard in the grid** over one named route. The file is parsed in the browser, previewed and mapped, then sent to `POST /api/tables/:tableId/records/import` in chunks of up to 100 rows. A script can post to the same route.

| Step               | What happens                                                                             | Underlying request                         |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| Upload             | A `.csv` is parsed in the browser and the first ten rows previewed with their columns    | none                                       |
| Mapping            | Each column is auto-matched to a field by header name; unmatched columns default to skip | none                                       |
| Duplicate handling | A unique field is chosen, plus skip, overwrite or create                                 | none                                       |
| Import             | Rows are written and a summary reports created, updated, skipped and failed separately   | `POST /records/import`, one call per chunk |

| Duplicate mode | Effect                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| Skip           | Rows whose unique field matches a record you can read are left alone, checked on the server |
| Overwrite      | The matching record is updated, as an upsert                                                |
| Create         | A new record is inserted regardless                                                         |

```
POST /api/tables/:tableId/records/import
{ "records": [{ "fields": { "email": "ada@example.com" } }], "strategy": "skip", "mergeOn": "email" }
→ { "created": 0, "updated": 0, "skipped": 1 }
```

`strategy` defaults to `create`; `skip` and `overwrite` need `mergeOn`, the field that identifies a duplicate. Overwrite matches the way an upsert does: `mergeOn` must be a field the importer may read, or the import answers `404` and writes nothing, and a record she may not read is never a duplicate — a row matching only such records is imported as a new one.

**Import is the one bulk path that is not all-or-nothing.** Valid rows are committed and invalid ones are not, which is the opposite of the batch endpoints' single transaction — and it is the right default for a human pasting a spreadsheet, who wants the 900 good rows in and a report on the 100 bad ones. Failed rows download as a CSV carrying the original data plus an `error` column, so fixing it and re-uploading retries exactly those rows.

Imported records pass the same field-type validation and the same field-level permissions as a batch create — or an upsert, for overwrite — and fire the table's webhooks and record automations once per row, like any other write. A table that declares `import: { fireEvents: false }` makes its imports silent: no webhook, no record automation, while every other way of writing to it still fires. Open grids still refresh.

## Export

```
GET /api/tables/:tableId/export?format=csv&fields=id,name,status
GET /api/tables/:tableId/export?format=json
GET /api/tables/:tableId/export?format=csv&recordIds=1,2,3
```

The response streams the file with an attachment disposition, named after the table and the day it was taken.

| Parameter     | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `format`      | `csv`, the default, or `json`                                |
| `filterField` | The field to filter on                                       |
| `filterValue` | The value that field must equal                              |
| `fields`      | Comma-separated columns; omitted means every readable column |
| `recordIds`   | Export only the named records                                |

**The export filter is a single field–value pair, not the list grammar.** It is what the grid's own filter bar produces. To export something that bar cannot express, list the records you want through the ordinary list endpoint and pass their ids as `recordIds`.

**Both formats carry RAW values**, not the formatted ones the grid displays: a currency column exports `1250.5`, not `€1,250.50`, and an attachment column exports its storage key rather than the signed URL the read path enriches it with. So a CSV taken out of one table re-imports into another without a translation step, and neither format has to be preferred on those grounds. The difference between them is shape — CSV is one header row and one row per record, JSON an array of objects — and in both the column name is the FIELD NAME as declared, never its `label`.

**One exception to raw values, in CSV only.** A text cell that begins with `=`, `+`, `-`, `@`, a tab or a carriage return is written with a leading `'`, so a spreadsheet opening the file reads it as text rather than running it as a formula; number cells are written unchanged. A number field's value never gains the prefix, even a negative one, so a column of balances still sums. JSON carries every value as stored.

The file is streamed with an attachment disposition named `<table>-<YYYY-MM-DD>` plus the extension, so a browser saves it under a name that says what it is and when it was taken.

Export honours field-level read permissions: columns the caller may not read are absent from the file rather than blank in it.

**A caller who may not read the table gets `404`**, with the same body a table that does not exist answers, as everywhere else in the records path: an export never tells a table kept from its caller apart from an absent one.

## Clipboard

A `table` supports spreadsheet-style copy and paste, built on the same endpoints.

| Action     | Behaviour                                                     | Underlying request |
| ---------- | ------------------------------------------------------------- | ------------------ |
| Paste rows | Tab-separated data from a spreadsheet, with a mapping preview | batch create       |
| Copy rows  | The selected rows' visible columns, as tab-separated values   | the list endpoint  |

Paste maps columns onto fields, shows a preview so the change can be confirmed, and then commits through a single batch create — so a paste is atomic even though an import is not.
