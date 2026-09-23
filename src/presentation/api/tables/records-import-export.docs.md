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

Import is a **wizard in the grid, not an endpoint**. The file is parsed in the browser, previewed, mapped, and then committed through the ordinary Records write endpoints. There is no import route to call — anything the wizard does, a script can do by posting to those same endpoints.

| Step               | What happens                                                                             | Underlying request                        |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| Upload             | A `.csv` is parsed in the browser and the first ten rows previewed with their columns    | none                                      |
| Mapping            | Each column is auto-matched to a field by header name; unmatched columns default to skip | none                                      |
| Duplicate handling | A unique field is chosen, plus skip, overwrite or create                                 | none                                      |
| Import             | Rows are written and a summary reports created, updated, skipped and failed separately   | batch create, or upsert for **overwrite** |

| Duplicate mode | Effect                                                |
| -------------- | ----------------------------------------------------- |
| Skip           | Rows whose unique field already exists are left alone |
| Overwrite      | The matching record is updated, through upsert        |
| Create         | A new record is inserted regardless                   |

**Import is the one bulk path that is not all-or-nothing.** Valid rows are committed and invalid ones are not, which is the opposite of the batch endpoints' single transaction — and it is the right default for a human pasting a spreadsheet, who wants the 900 good rows in and a report on the 100 bad ones. Failed rows download as a CSV carrying the original data plus an `error` column, so fixing it and re-uploading retries exactly those rows.

Imported records pass the same field-type validation and the same field-level permissions as any other create, because they are ordinary creates.

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

The file is streamed with an attachment disposition named `<table>-<YYYY-MM-DD>` plus the extension, so a browser saves it under a name that says what it is and when it was taken.

Export honours field-level read permissions: columns the caller may not read are absent from the file rather than blank in it.

**The read gate answers `403`, not `404`** — the one place in the records path that does. Everywhere else a denial is made indistinguishable from absence, but an export is an action the caller explicitly asked for on a table they can already see listed, so it is refused as a refusal. Do not write a client that treats `404` as the only denial here.

## Clipboard

A `table` supports spreadsheet-style copy and paste, built on the same endpoints.

| Action     | Behaviour                                                     | Underlying request |
| ---------- | ------------------------------------------------------------- | ------------------ |
| Paste rows | Tab-separated data from a spreadsheet, with a mapping preview | batch create       |
| Copy rows  | The selected rows' visible columns, as tab-separated values   | the list endpoint  |

Paste maps columns onto fields, shows a preview so the change can be confirmed, and then commits through a single batch create — so a paste is atomic even though an import is not.
