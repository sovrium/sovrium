# File Actions

> Sixteen operators over storage — moving files, reading their metadata, generating documents, and the closed spreadsheet subset that decides which workbooks are accepted.

File actions operate against the app's configured storage, whether that is the local filesystem or an object store.

## Storage

| Operator   | Props                             | Does                       |
| ---------- | --------------------------------- | -------------------------- |
| `upload`   | `source`, `path?`, `contentType?` | Uploads a file to storage  |
| `download` | `key`                             | Downloads a stored file    |
| `delete`   | `key`                             | Deletes a stored file      |
| `copy`     | `source`, `destination`           | Copies a stored file       |
| `move`     | `source`, `destination`           | Moves or renames a file    |
| `list`     | `prefix`, `limit?`                | Lists files under a prefix |

## Metadata and access

| Operator      | Props                             | Does                                            |
| ------------- | --------------------------------- | ----------------------------------------------- |
| `getMetadata` | `key`                             | Reads size, content type and the rest           |
| `signUrl`     | `key`, `expiresIn?`, `operation?` | Mints a time-limited URL for download or upload |

## Generation

| Operator       | Props                                                                                    | Does                            |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| `generatePdf`  | `template`, `filename`, `data?`, `pageSize?`, `orientation?`, `margins?`, `destination?` | Renders an HTML template to PDF |
| `generateCsv`  | `data`, `filename`, `columns?`, `delimiter?`, `includeHeaders?`, `destination?`          | Writes a CSV from an array      |
| `generateXlsx` | `data?` or `sheets?`, `filename`, `columns?`, `sheetName?`, `destination?`               | Writes a workbook from rows     |

## Parsing and transforming

| Operator         | Props                                                                        | Does                                |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| `parseCsv`       | `source?`, `key?`, `content?`, `columns?`, `skipRows?`, `delimiter?`         | Parses CSV into rows                |
| `parseXlsx`      | `source?`, `key?`, `sheet?`, `header?`, `range?`, `skipRows?`                | Parses a worksheet into rows        |
| `extractText`    | `source`, `format?`                                                          | Extracts text from a document       |
| `transformImage` | `source`, `width?`, `height?`, `fit?`, `format?`, `quality?`, `destination?` | Resizes or converts an image        |
| `compress`       | `files`, `filename`, `destination?`                                          | Zips several files into one archive |

<!-- sovrium:options FileActionSchema -->

## CSV

`parseCsv` needs exactly one input: `source` (a storage key), `key` (its alias), or `content` — inline CSV text, which parses a webhook body or an earlier step's output without a storage round-trip. Omitting all three is a configuration error.

`skipRows` drops that many leading non-blank lines and nothing else, so it strips a preamble without changing the shape of the output: the first line that survives is still read as the header, and rows stay keyed by header name.

`delimiter` is one of comma, semicolon, tab or pipe. Omitted, it is auto-detected by counting candidates **outside quoted fields** in the first surviving line, so a semicolon-delimited export whose header legitimately contains a comma still reads correctly. Pass `columns` to map explicitly instead, each entry taking a `name` plus either a `header` name or a zero-based `index`.

## Spreadsheets — a closed subset

`parseXlsx` and `generateXlsx` support a **named, closed subset** of the spreadsheet format rather than the format at large. On the way in that subset is: shared and inline strings, numbers, booleans, dates recognised through the cell's number format — an Excel date serial is otherwise indistinguishable from a plain number — and formulas read as their **cached value**, never evaluated. Dates come back as ISO 8601 strings rather than date objects, so they survive being persisted to run history and re-read by a template.

### The wall is at data outside the cell grid

A workbook carrying a chart, a drawing, an embedded image, a pivot table or a macro is **refused by name**. Reading it would hand back the cells and quietly drop the part of the document its author cared about, which is the worst available outcome: a plausible answer that is missing the point of the file.

Refusal is detected on both the archive's part paths and its content-type overrides, because the two can disagree. Cosmetic styling — fonts, fills, borders — is **not** refused but ignored, since refusing it would refuse essentially every real workbook. Outside the subset the action fails loudly and deliberately: convert the file rather than trust a wrong answer.

### Reading

`parseXlsx` takes the workbook as `source` or its alias `key`; a data URI and an `https` URL are also accepted. `sheet` selects a worksheet by name, or by zero-based position when given a number; omitted, the first sheet in the workbook's declared order is read. `range` restricts reading to an A1-style window, defaulting to the sheet's used range. `header` treats the first row as a header, promoting it to `columns` and excluding it from the data. `skipRows` then drops that many rows off the top of the grid.

The output carries the rows plus the sheet's name, every sheet name in the workbook, the row count and the columns. That list of names is what lets an automation discover a workbook's sheets on a first call and target one on a second.

```yaml
- name: importSheet
  type: file
  operator: parseXlsx
  props:
    source: '{{trigger.data.key}}'
    sheet: Orders
    header: true
    range: 'A1:F500'
```

### Writing

`generateXlsx` writes the minimal part set a consumer requires, adding a styles part only when a date cell is present. Pass `data` for a single sheet, naming it with `sheetName`, or `sheets` for several, each entry taking a name, its own data and optionally its own columns. `columns` selects and orders the fields and supplies their header labels.

The refusal here is per **cell value**: anything outside string, number, boolean and date — an object, an array, a bigint, a not-a-number, an invalid date — fails the step with an error naming the sheet and the cell reference, rather than being coerced into a plausible-looking string.

Round-tripping a generated workbook back through the parser is lossless **within** the subset, and only within it.

```yaml
- name: exportOrders
  type: file
  operator: generateXlsx
  props:
    data: '{{fetchOrders.records}}'
    filename: 'orders-{{trigger.data.month}}.xlsx'
    sheetName: Orders
    destination: exports/
```

## PDF and images

```yaml
- name: invoice
  type: file
  operator: generatePdf
  props:
    template: invoice-template
    filename: 'invoice-{{trigger.data.id}}.pdf'
    data: '{{trigger.data}}'
    pageSize: A4
    orientation: portrait
    destination: invoices/
```

```yaml
- name: thumbnail
  type: file
  operator: transformImage
  props:
    source: '{{upload.result.key}}'
    width: 320
    format: webp
    quality: 70
```

A conversion naming no format encodes to WebP, and a plain resize keeps the source format rather than transcoding it. That is the built-in behaviour rather than a setting — name a format on the action when a particular consumer needs another codec.
