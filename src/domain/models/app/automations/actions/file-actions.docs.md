# File Actions

> Fourteen operators over storage — moving files, reading their metadata, writing CSV, and the closed spreadsheet subset that decides which workbooks are read.

File actions operate against the app's configured storage, whether that is the local filesystem or an object store.

## Storage

| Operator   | Props                                                    | Does                       |
| ---------- | -------------------------------------------------------- | -------------------------- |
| `upload`   | `source`, `path?`, `bucket?`, `contentType?`, `headers?` | Uploads a file to storage  |
| `download` | `key`                                                    | Downloads a stored file    |
| `delete`   | `key`                                                    | Deletes a stored file      |
| `copy`     | `sourceKey`, `destinationKey`                            | Copies a stored file       |
| `move`     | `sourceKey`, `destinationKey`                            | Moves or renames a file    |
| `list`     | `prefix`, `limit?`                                       | Lists files under a prefix |

A copy or a move keeps the source's bucket: a file uploaded through a bucket stays reachable through that bucket's API, and by `ai/transcribe` with `bucket`, under its new key. A file that belongs to no bucket stays in none.

An `upload` `source` is a storage key, a `data:` URI or an `http(s)` URL. A URL may not point at a private, loopback or link-local address, and neither may any redirect it answers with: every hop is checked before it is requested, up to five are followed, and a refused one makes the step's output carry `error: invalid_outbound_url_<reason>` with nothing stored. A remote file is read up to 100 MiB; a larger one is not stored. Host names are not resolved before the check.

A URL that needs credentials takes `headers`, whose values read template variables and `$env` secrets — for example `headers: { X-API-KEY: $env.MESSAGING_API_KEY }` to store a message attachment a messaging API serves only to its key. The headers go with the download and with a redirect to the same origin; a redirect to another origin is followed without them. Every header value is treated as a secret, whether it is a literal, a template or an `$env` reference: it never appears in the step's output, the run detail or the admin run detail. Headers are sent to the source as you write it, a plain `http://` URL included — use an `https://` source so they are not sent in clear.

Without `bucket`, an uploaded file is temporary and belongs to no bucket, so an attachment column bound to a bucket refuses its key. To mirror a file into a record — a messaging API's attachment written into a message — give the step the `bucket` of the column it goes to, then write `{{steps.<upload>.key}}` into that column with a `record/update`; the step's output then carries `bucket` instead of `path` or `temporary`. `bucket` is a name from `buckets`, or `system`, and it is written as is, never as a template: an app whose step names a bucket it does not declare is refused at start, naming that bucket, and a `code` step that calls the upload with such a bucket fails. The file is stored with no uploader, as stored by the automation, whatever the bucket's `upload` roles say about whoever triggered the run, and it does not need a record step. With a `path`, a key already holding a file the automation did not store, such as a person's upload, fails the step and the file there is kept; a file the same automation stored there before is replaced. Without a `path`, a fresh key is minted. With or without `bucket`, a `path` must be a relative key with no empty, `.` or `..` segment and no backslash, or the step fails and nothing is stored.

## Metadata and access

| Operator      | Props                                             | Does                                            |
| ------------- | ------------------------------------------------- | ----------------------------------------------- |
| `getMetadata` | `key`                                             | Reads a stored file's metadata, not its bytes   |
| `signUrl`     | `key`, `expiresIn?`, `operation?`, `contentType?` | Mints a time-limited URL for download or upload |

`getMetadata` returns the file's catalogue entry, and its output keys are a stable contract:

| Key            | Always present | Holds                                                                                                                                                      |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`          | yes            | The storage key that was read                                                                                                                              |
| `contentType`  | yes            | The stored content type, for example `image/png`                                                                                                           |
| `size`         | yes            | The size in bytes, a number                                                                                                                                |
| `lastModified` | yes            | When the file was stored, an ISO 8601 timestamp                                                                                                            |
| `uploadedBy`   | no             | The id of the user who uploaded it — signed in, or through one of their API keys. Absent when nobody is recorded: an anonymous form, an automation, a seed |
| `generatedBy`  | no             | The name of the automation whose document action wrote it. Absent for any other file                                                                       |

So `{{steps.inspect.uploadedBy}}` names the uploader of the file a `getMetadata` step called `inspect` read, and a condition can check it is the account you expect; check it with `isNotEmpty` first, since an anonymous upload has none. The bucket the file belongs to is not part of the output. A key with no stored file is not a failure of the run: the step's output carries `error: file not found: <key>` instead, and a missing `key` carries `error: file.getMetadata requires a key`.

`list` returns keys only — `files` is an array of `{ key }`, at most `limit` of them — so read one file's size, type or uploader with a `getMetadata` step per key.

A download URL points at the app itself on every storage provider (local disk, the database, or an S3-compatible store): the app checks the link when it is followed and serves the file with no session needed, and refuses a link whose path, expiry or signature was altered, or whose lifetime has passed.

An upload URL points at the app itself and writes into the private `system` bucket: the file is catalogued there with no uploader, the bound content type and the deployment's file size limit apply, and a key that already holds a file is refused, both when the URL is minted and when it is used.
Either URL is absolute when `BASE_URL` is set and a path from the site root otherwise, and its `expiresIn` is held between one minute and seven days.
`contentType` is ignored for a download.

A signed link opens whatever file its `key` names, for anyone holding it, until it expires. Never build `key` from trigger, webhook or request values: whoever sends that input could then have the automation sign a link to any stored file. Take the key from a record the run has already read, and keep `expiresIn` as short as the recipient needs. The link also appears in the run history, where admins, and anyone who started the run by hand, can read it.

## Generation

| Operator      | Props                                                                           | Does                       |
| ------------- | ------------------------------------------------------------------------------- | -------------------------- |
| `generateCsv` | `data`, `filename`, `columns?`, `delimiter?`, `includeHeaders?`, `destination?` | Writes a CSV from an array |

PDFs, images and workbooks are generated by the `document` family (`document/generatePdf`, `document/generateImage`, `document/generateXlsx`), which writes through `output` to temporary storage or a record's attachment field.

## Parsing and transforming

| Operator         | Props                                                                                                                                      | Does                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `parseCsv`       | `source?`, `key?`, `content?`, `columns?`, `skipRows?`, `delimiter?`                                                                       | Parses CSV into rows                |
| `parseXlsx`      | `source?`, `key?`, `sheet?`, `header?`, `range?`, `skipRows?`                                                                              | Parses a worksheet into rows        |
| `extractText`    | `key?` or `source?` (one is required), `format?`                                                                                           | Extracts text from a document       |
| `transformImage` | `key?` or `source?` (one is required), `operation?`, `width?`, `height?`, `fit?`, `format?` or `outputFormat?`, `quality?`, `destination?` | Resizes or converts an image        |
| `compress`       | `keys?` or `files?` (one is required), `filename?`, `destination?`                                                                         | Zips several files into one archive |

<!-- sovrium:options FileActionSchema -->

## CSV

`parseCsv` needs exactly one input: `source` (a storage key), `key` (its alias), or `content` — inline CSV text, which parses a webhook body or an earlier step's output without a storage round-trip. Omitting all three is a configuration error.

`skipRows` drops that many leading non-blank lines and nothing else, so it strips a preamble without changing the shape of the output: the first line that survives is still read as the header, and rows stay keyed by header name.

`delimiter` is one of comma, semicolon, tab or pipe. Omitted, it is auto-detected by counting candidates **outside quoted fields** in the first surviving line, so a semicolon-delimited export whose header legitimately contains a comma still reads correctly. Pass `columns` to map explicitly instead, each entry taking a `name` plus either a `header` name or a zero-based `index`.

`generateCsv` quotes a value that carries the active delimiter, a quote or a line break. A text cell that begins with `=`, `+`, `-`, `@`, a tab or a carriage return is written with a leading `'`, so a spreadsheet opening the file reads it as text rather than running it as a formula; number cells are written unchanged. A value is a number when the data hands it over as one; a number that a template rendered into text is text.

## Spreadsheets — a closed subset

`parseXlsx` and its writer `document/generateXlsx` support a **named, closed subset** of the spreadsheet format rather than the format at large. On the way in that subset is: shared and inline strings, numbers, booleans, dates recognised through the cell's number format — an Excel date serial is otherwise indistinguishable from a plain number — and formulas read as their **cached value**, never evaluated. Dates come back as ISO 8601 strings rather than date objects, so they survive being persisted to run history and re-read by a template.

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

A workbook is written by `document/generateXlsx`, in the same subset: see Document Actions.

## Images

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
