# Document Actions

> Generate a PDF, an image, a Word document or a workbook from a template filled with your data, a workbook from rows, or convert a file to PDF, and write it to temporary storage or a record's attachment field.

Document actions replace the "copy a document, replace its text, export it, store the link" scripts that live outside an app. The template is versioned beside the config or uploaded to a bucket, the data comes from the run, and the result is a file in the app's own storage that the next step, an email or a record can use.

| Operator        | Props                                                                                                                                  | Does                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `generatePdf`   | `template`, `data?`, `pageSize?`, `orientation?`, `margins?`, `header?`, `footer?`, `locale?`, `allowRemoteAssets?`, `output`          | Renders an HTML template to a paginated PDF                                   |
| `generateImage` | `template`, `templateType?`, `data?`, `format?`, `quality?`, `width?`, `height?`, `preset?`, `locale?`, `allowRemoteAssets?`, `output` | Renders an SVG or HTML template to an image                                   |
| `generateDocx`  | `template`, `data?`, `locale?`, `output`                                                                                               | Fills a Word (`.docx`) template                                               |
| `generateXlsx`  | `template?`, `data?` or `sheets?`, `columns?`, `sheetName?`, `locale?`, `output`                                                       | Writes a workbook from rows, or fills a workbook template                     |
| `convert`       | `input`, `inputType?`, `output`                                                                                                        | Converts a Word, Excel, PowerPoint, OpenDocument, HTML or image file to a PDF |

<!-- sovrium:options DocumentActionSchema -->

## Templates and data

`template` says where the template is read from:

- `{ asset: templates/badge.svg }` — a private file declared in the top-level `assets` list, shipped with the config and never served;
- `{ key, bucket }` — a file in a bucket, which someone can replace at run time without a config change; like an asset, it weighs at most 10 MB, and a larger one fails the step naming the limit before it is read;
- `{ inline: '<svg …><text>{{attendee.name}}</text></svg>' }` — text written in the config (not for a `.docx`, which is a file).

`data` is the template's whole context. Its values are resolved like any prop, so `lines: '{{steps.fetchLines.result}}'` stays the array it names, and the template reads them by name: `{{attendee.name}}`, `{{#each lines}}…{{/each}}`, `{{#if attendee.vip}}…{{/if}}`. A template sees `data` and nothing else — `{{trigger.data.name}}` written inside a template renders empty; pass it through `data`. The run's own template pass never touches the template text.

A value is escaped for the output it lands in: HTML-escaped in HTML, XML-escaped in SVG and in a Word document. A name containing `&` or `<` prints as written and never breaks the file; markup from a form prints as text. So never escape a value yourself in an SVG or Word template: `{{escapeHtml name}}` there is escaped a second time, and `Dupont & Fils` prints as `Dupont &amp; Fils`. To place rich text from your data in an HTML template, use `{{{safeHtml value}}}`, which keeps its formatting and removes anything unsafe.

A template read from a bucket is treated as written by whoever may upload to that bucket: a call to `regex`, `matchAll` or `log` fails the step naming the helper, and a name that is not a helper is read as a value, never called. A template that does not compile fails the step instead of producing a file.

## Helpers, partials and translations

Every template — HTML, SVG, Word, email, plain text — has the formatting helpers of the run's templates, plus the document helpers (`chunk`, `pageBreak`, `image`, `qrcode`, `t`), partials and layouts declared in `assets`, and translations from `languages`. What each one prints, and what each output format does with it, is in Template Helpers: `sovrium docs automations/template-helpers`.

A picture comes from a declared image asset, a stored file the configuration names, or a file an earlier step of the run produced — never a URL, and never a `{ key, bucket }` that arrives with the request. The same rule covers the `header` and `footer` templates of a PDF.

## Where the file goes

`output` is `{ filename, bucket?, key?, ifExists?, attachTo? }`, and the step returns `{ key, bucket?, filename, contentType, size, pages?, width?, height? }`. A later step reads the file as `{ step: <name> }`.

- With no `attachTo`, the file is **temporary**: it is written under `tmp/automations/`, belongs to no bucket, is served by no route, and is removed by the temporary-file sweep once it is older than `STORAGE_TEMP_CLEANUP_AFTER` (24 hours by default). A `key` is placed under that prefix, and swept like any other temporary file: `key: exports/latest.xlsx` writes `tmp/automations/exports/latest.xlsx`. A later step of the same run reads it through `{ step: <name> }`; anything that needs the file longer attaches it to a record.
- `bucket` only names the bucket of the `attachTo` field. A `bucket` without `attachTo` is refused by `validate`: a file in a bucket that belongs to no record could be neither exported nor erased for anyone, so a generated file is attached to a record or temporary.
- With `attachTo: { table, record, field, mode? }`, it is written into that record's attachment field, in **the bucket the field is bound to** (the `system` bucket when the field names none). Naming a different `bucket` beside `attachTo` is refused by `validate`, naming both buckets. `mode` is `replace` (the default on a `single-attachment` field; the replaced file is deleted, unless another record — in any table, in a single or a multiple attachments field — still names it) or `append` (the default on `multiple-attachments`). The field's own rules — allowed file types, maximum size, maximum count — apply. An attached file is deleted when its record is purged, unless another record still names it, in the same way.

`ifExists` decides what happens when a file already sits at `key`: `overwrite` (default), `suffix` (`name-1.ext`, `name-2.ext`, … up to `name-1000.ext`, past which the step fails naming the limit), `skip` (keep it and return it — and, with `attachTo`, attach it to the record when the run acts for a person who may download it; a run that acts for nobody attaches only a file it wrote itself, so there `skip` fails the step and leaves the record unchanged) or `fail` (the step fails, naming the key). `overwrite` and `skip` only take a file the same automation generated: a file a person uploaded, or another automation generated, is kept and the step fails. An automation is known by its name, so a renamed automation no longer owns the files it generated under its old name: the first run that meets one of them fails, and the file is kept. Delete the old file, or write under a new key.

## PDF

`generatePdf` renders an HTML template with the document renderer. `pageSize` is `A3`, `A4` (default), `A5`, `Letter` or `Legal`; `orientation` is `portrait` (default) or `landscape`; each margin is a length in `mm`, `cm`, `in`, `pt` or `px`. Content longer than a page flows onto the next ones, and the step result carries `pages`, the page count of the stored file. `header` and `footer` are templates printed on every page, aligned with the page margins, rendered with the same `data` plus `{{pageNumber}}` and `{{totalPages}}`:

```yaml
- name: renderInvoice
  type: document
  operator: generatePdf
  props:
    template: { asset: templates/invoice.html }
    data:
      invoice: '{{trigger.data}}'
      lines: '{{steps.fetchLines.result}}'
    pageSize: A4
    margins: { top: 20mm, right: 15mm, bottom: 20mm, left: 15mm }
    footer: { inline: '<div style="font-size:9px">Page {{pageNumber}} of {{totalPages}}</div>' }
    output:
      filename: 'invoice-{{trigger.data.number}}.pdf'
      attachTo: { table: invoices, record: '{{trigger.data.id}}', field: pdf }
```

## What an HTML render can reach

A template is yours; the data in it is not. Every HTML render — a PDF or an image — runs with scripts disabled. Images, fonts and stylesheets load from `assets` (named by their declared path) or inline `data:` URLs only; `file://` never loads. Any other URL is removed before the render unless the action sets `allowRemoteAssets: true`: the request is never made, and nothing is drawn in its place. With `allowRemoteAssets`, Sovrium — not the browser — fetches each URL through the same guarded outbound path as every other call, which refuses private-network addresses unless the operator allows them. With `RENDERER_PROVIDER=gotenberg`, which renders outside Sovrium's reach, the document itself is made inert before it is sent: every `<meta http-equiv>` other than the content policy, every `<link>` that loads something, every CSS `@import` and every CSS `url()` that is not a `data:` URL are removed, and the content policy comes before the template's first byte. Whatever the renderer, every `<noscript>` element is removed too: with scripts off, a browser would show its content as ordinary markup. So a template, even one read from a bucket, cannot redirect the page or load anything from the network. Inline styles and `data:` images still render. A render that needs a renderer when none is configured fails with `renderer_unavailable`, naming the variable to set; one past a limit fails with `render_limit_exceeded` or `render_timeout`, naming the limit. Nothing is written in either case.

## Images

An SVG template is rendered inside Sovrium and needs no engine; `width` or `height` alone scales it and keeps its proportions, and neither keeps the SVG's own size. Text uses IBM Plex Sans by default, in regular and bold; it ships inside Sovrium, so text renders even on a host with no fonts installed. Fonts declared in `assets` (`.ttf` or `.otf`) take precedence: text whose `font-family` names one is drawn with it, and text that names no font, or one that is not available, uses the first declared font, or IBM Plex Sans when none is declared. An SVG render fetches nothing: an image it links to on the network is not loaded. An SVG larger than 16,384 pixels on a side, or 40 megapixels in all, is refused before it is drawn, with `render_limit_exceeded`.

An HTML template is rendered by the browser engine at a `width` × `height` viewport (1200 pixels wide by default; without `height`, the full height of the page). It needs the document renderer, configured with the `RENDERER_*` variables described under document rendering in the environment variables: with none, the step fails with `renderer_unavailable`, naming the variable to set. The rules of an HTML render above apply.

Whether a template is SVG or HTML comes from `templateType`, else from the asset's kind or the key's extension, else from an inline template's first element (`<svg` means SVG). `format` is `png` (default), `jpeg` or `webp`; `quality` (1–100) applies to the last two.

`preset: og` renders a social card: an HTML template at exactly 1200 × 630 pixels, the size link previews expect, edge to edge (the page has no margin), as a PNG — or a JPEG with `format: jpeg`. It is an HTML render like any other — it needs the browser engine and follows the same rules — so with no renderer it fails with `renderer_unavailable`. `width`, `height`, `format: webp` and an SVG template are refused with it by `validate`.

## Word documents

`generateDocx` fills a `.docx` template, from `assets` or a bucket, with the same tags as every template. `{{#each lines}}` in the first cell of a table row and `{{/each}}` in its last cell repeat the row once per item; `{{#if …}}` and `{{/if}}` in paragraphs of their own keep or remove the paragraphs between them, and leave no empty line behind. A block tag cannot cross a table boundary: it opens and closes in the same cell, row or run of paragraphs. A tag Word split across several formatting runs — after a spell check or a format change — is still recognised. Headers and footers are filled like the body, and `{{pageBreak}}` and `{{image}}` work as in every template. Values are XML-escaped, so `Dupont & Fils` never corrupts the file. Partials and `qrcode` are not available in a Word template: the step fails naming them.

Web and mail links (`http`, `https`, `mailto`) in the template survive; every other external link — a linked file, an included document, an embedded object's source — is removed, so a filled document never makes its reader's software fetch something on its own. A template that is not a Word document, or one carrying macros, fails the step naming it, and nothing is written. The fill runs inside Sovrium; no engine is needed.

```yaml
- name: fillContract
  type: document
  operator: generateDocx
  props:
    template: { asset: templates/contract.docx }
    data:
      client: '{{trigger.data}}'
      lineItems: '{{steps.fetchLines.result}}'
    output:
      filename: 'contract-{{trigger.data.reference}}.docx'
      attachTo: { table: contracts, record: '{{trigger.data.id}}', field: document }
```

## Workbooks

`generateXlsx` writes the minimal package an `.xlsx` reader needs: one worksheet per sheet, a shared-string table, and a styles part only when a date cell needs one. Pass `data` for a single sheet, named with `sheetName`, or `sheets` for several, each with its own `name`, `data` and `columns`; the two are mutually exclusive. `columns` selects and orders the fields and supplies their header labels; a key no column names never becomes a cell.

A cell is a string, a number, a boolean or a date, and keeps that type when the workbook is read back with `file/parseXlsx`. Any other value — an object, an array, a not-a-number, an invalid date — fails the step, naming the sheet and the cell.

```yaml
- name: exportOrders
  type: document
  operator: generateXlsx
  props:
    data: '{{steps.fetchOrders.result}}'
    sheetName: Orders
    output:
      filename: 'orders-{{trigger.data.month}}.xlsx'
      key: exports/orders.xlsx
```

It replaces `file/generateXlsx`, which `validate` now refuses: move `filename` and `destination` into `output: { filename, key }`.

### Filling a workbook template

With `template` — `{ asset }` or `{ key, bucket }` — `generateXlsx` fills a workbook designed in Excel instead of writing one from rows. `data` is then the template's values, like every other document action, and `validate` refuses `sheets`, `columns`, `sheetName` and a `data` that is a list of rows. On every sheet, cells holding tags are filled. A cell holding a single tag takes its value's type, so a number stays a number (a `SUM` over it adds it), a boolean a boolean, and an ISO date (`2026-10-08`) becomes a date shown in the cell's own format; a cell mixing text and tags is text. A row whose first cell opens `{{#each lines}}` and whose last cell closes `{{/each}}` repeats once per item, in order, each copy keeping the styles of the template row; the rows below move down, a formula whose range covered that row is widened to cover them all (`SUM(D5:D5)` → `SUM(D5:D7)`), and a formula inside the repeated row reads its own copy, as Excel's copy would (`B5*C5` → `B6*C6`, an absolute `$B$5` unchanged). Styles, the other formulas, merged cells, column widths and sheet names are kept, values are escaped so the workbook stays well-formed, and Excel recalculates every formula when it opens the file. A template that is not a workbook fails the step, naming it, and nothing is written. The fill runs inside Sovrium; no engine is needed.

```yaml
- name: fillQuote
  type: document
  operator: generateXlsx
  props:
    template: { asset: templates/quote.xlsx }
    data:
      quote: '{{trigger.data}}'
      lines: '{{steps.fetchLines.result}}'
    output: { filename: 'quote-{{trigger.data.number}}.xlsx' }
```

## Converting a file to PDF

`convert` turns a file — any file reference: a previous step, a key, `{ key, bucket }`, an asset or a record attachment — into a PDF, as it is: nothing in it is templated, so `{{ }}` in it prints as written. Word, Excel, PowerPoint and OpenDocument files go to the office engine (`OFFICE_*`, see the document-rendering environment variables), under a fixed name of Sovrium's carrying only the file's own extension, so the engine reads it as what it is and never sees the name it was stored under; HTML files go to the browser engine, under the rules of an HTML render (scripts off, nothing fetched); PNG, JPEG and WebP pictures become one page, laid out as `pdf/fromImages` does by default, with no engine. The type comes from `inputType` when set, else from the stored content type, else from the file name. The step result carries `pages`.

Before a Word, Excel, PowerPoint or OpenDocument file leaves Sovrium, its linked files, included documents and fetching field codes are removed — web and mail links stay — so the converter is never asked to fetch anything. RTF files are not accepted: they cannot be cleaned that way. With no office engine the step fails with `office_unavailable`, naming the variable to set; a conversion past `OFFICE_TIMEOUT_MS` fails with `render_timeout`; a file the engine refuses, or an answer that is not a PDF, fails with `office_conversion_failed`; a file nothing converts fails with `unsupported_input`, listing the accepted types. Nothing is written in any of these cases.

```yaml
- name: toPdf
  type: document
  operator: convert
  props:
    input: { step: fillContract }
    output:
      filename: 'contract-{{trigger.data.reference}}.pdf'
      attachTo: { table: contracts, record: '{{trigger.data.id}}', field: signed_pdf }
```
