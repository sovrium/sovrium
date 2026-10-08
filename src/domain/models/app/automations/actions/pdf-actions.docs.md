# PDF Actions

> Merge, split and rearrange PDFs you already have, mark them with a watermark, a stamp or page numbers, fill their forms, read what they hold, or make one from pictures — all with no external engine.

PDF actions work on existing PDFs; generating one from a template is `document/generatePdf`. They run inside Sovrium, so they work on a bare install with no browser and no office suite.

| Operator     | Props                                                                                                                                                | Does                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `merge`      | `inputs`, `output`                                                                                                                                   | Joins PDFs, or chosen pages, into one                    |
| `split`      | `file`, `ranges?` or `every?`, `output`                                                                                                              | Cuts one PDF into several                                |
| `pages`      | `file`, `operation`, `pages`, `angle?`, `output`                                                                                                     | Deletes, extracts, reorders or rotates pages             |
| `watermark`  | `file`, `text` or `image`, `opacity?`, `angle?`, `position?`, `fontSize?`, `color?`, `width?`, `pages?`, `output`                                    | Draws a translucent mark across pages                    |
| `stamp`      | `file`, `text`, `image` or `pageNumbers`, `position?` or `at?`, `margin?`, `fontSize?`, `color?`, `opacity?`, `angle?`, `width?`, `pages?`, `output` | Places a mark at a precise spot                          |
| `fillForm`   | `file`, `fields`, `flatten?`, `output`                                                                                                               | Writes values into a PDF form                            |
| `inspect`    | `file`                                                                                                                                               | Reads pages, sizes, metadata, encryption and form fields |
| `fromImages` | `images`, `pageSize?`, `orientation?`, `fit?`, `margin?`, `output`                                                                                   | Makes a PDF of pictures, one page each                   |

<!-- sovrium:options PdfActionSchema -->

## Inputs

`inputs` is a list merged in its order. Each item is a file reference, or `{ file, pages }` to take only some pages:

| Form                                       | Reads                                                              |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `'<key>'`                                  | a storage key                                                      |
| `{ key, bucket }`                          | a file in a bucket                                                 |
| `{ step: <name> }`                         | the file a previous step produced                                  |
| `{ asset: <path> }`                        | a private file declared in `assets`                                |
| `{ record: { table, id, field, index? } }` | the file in a record's attachment field (`index` defaults to `0`)  |
| `{ url }`                                  | a file fetched over the network; private-network addresses refused |

`pages` lists 1-based pages and ranges in the order they are taken: `'3'`, `'1-3'`, `'5-'` (to the end), `'3,1-2'`.

`inputs` may also be one template that resolves to a list when the step runs — `inputs: '{{steps.renderLabels.results}}'` — so the files a loop produced merge into one.

A file reference reads at most 100 MiB; a larger file fails the step naming it, a stored one before it is read. A merge takes at most 100 inputs, and is held to the renderer's page and size limits (`RENDERER_MAX_PAGES`, `RENDERER_MAX_OUTPUT_BYTES`) over the pages taken from them all; each refusal names its limit and nothing is written.

```yaml
- name: buildClientFile
  type: pdf
  operator: merge
  props:
    inputs:
      - { step: storeCover }
      - file: { record: { table: clients, id: '{{trigger.data.id}}', field: signed_contract } }
        pages: '1-3'
      - { key: legal/terms-2026.pdf, bucket: library }
    output:
      filename: 'client-file-{{trigger.data.reference}}.pdf'
      attachTo: { table: clients, record: '{{trigger.data.id}}', field: client_file }
```

The output follows the document actions' rules: temporary by default, or attached to a record's attachment field. The step result carries `pages`.

Every operator that reads one PDF takes it as `file`, with the same forms. `pages`, wherever it appears, may also be one template resolving to such a list when the step runs (`pages: '{{trigger.data.pages}}'`); a page beyond the end of the file fails the step, naming the range and the file's page count.

## Splitting

`split` cuts `file` one of three ways: `ranges: ['1-2', '3-5', '6-']` writes one file per item, `every: 2` writes one file per two pages (the last holding what is left), and neither writes one file per page. `{n}` in the output `filename` or `key` is the part number, from 1; a name without it gets `-{n}` before its extension, so parts never overwrite one another. The step returns `{ files, count }` — every part, in order, each with its own `pages` — so `'{{steps.<name>.files}}'` feeds a loop or a later `merge`. With `attachTo`, the parts go into a multiple-attachments field one after another; a field that holds one file refuses a split into several parts.

```yaml
- name: splitStatements
  type: pdf
  operator: split
  props:
    file: { key: '{{trigger.data.bundle}}', bucket: library }
    every: 2
    output: { filename: 'statement-{n}.pdf' }
```

## Changing pages

`pages` takes an `operation`:

- `delete` removes the listed `pages` and keeps the others in order; at least one page must stay;
- `extract` keeps only the listed `pages`, in the order listed;
- `reorder` puts every page in the order listed, which must name each page exactly once — a page left out or repeated fails the step, naming it;
- `rotate` turns the listed `pages` (every page by default) clockwise by `angle` — 90, 180 or 270 — added to each page's current rotation, so a page shown at 90 turned by 270 ends upright.

## Watermarks and stamps

Both draw one mark — `watermark` takes `text` or `image`, `stamp` takes `text`, `image` or `pageNumbers` — and both measure in points (1/72 inch; an A4 page is 595 × 842) from the page's **top-left** corner. `position` is one of nine anchors, `top-left` to `bottom-right`, kept `margin` points from the edges (36 by default); `stamp` also takes `at: { x, y }`, the mark's top-left corner. Angles are degrees counter-clockwise. `image` is a file reference to a PNG or a JPEG, drawn `width` points wide with its proportions kept. `pages` limits the mark to some pages. A turned mark is placed by the box it covers, so it stays on the page as an upright one does.

Text is drawn in Helvetica, which covers Latin scripts — accents, `€`, `—`. A character it cannot draw (Chinese, Japanese, Arabic, emoji…) fails the step, naming the character: custom fonts are not supported yet. The same holds for the text `fillForm` writes into a form.

They differ in their defaults. A **watermark** is centred, at 45 degrees (0 for an image), at 30 % opacity, grey 48-point text or an image half the page wide, over the content of every page. A **stamp** sits at the bottom-right corner (bottom-centre for page numbers), solid, upright, black 12-point text or the image at its own pixel width read as points.

`pageNumbers: { format?, startAt? }` prints a number on each listed page. In `format` (default `'{n}'`), `{n}` is the page's number and `{total}` the number the last numbered page carries. `startAt` is the number the first numbered page carries — by default its own position in the file — so a cover can stay blank and the pages after it start at 1:

```yaml
- name: numberPages
  type: pdf
  operator: stamp
  props:
    file: { step: assembleReport }
    pageNumbers: { format: 'Page {n} of {total}', startAt: 1 }
    pages: '2-'
    output: { filename: report.pdf }
```

`{n}` and `{total}` take single braces because the step fills them page by page, after the run's own `{{…}}` values are resolved. They are read only inside `format`: a `text` stamp prints them as written. A signature picture placed with `image` is a picture on the page, not a cryptographic signature.

## Forms

`fillForm` writes `fields` into a PDF form by field name — the names `inspect` lists. A text field takes text (a number is written as text), a checkbox `true` or `false`, a radio group or a dropdown the option to choose, a multiple-choice list a list of options. `fields` may be one template resolving to the whole map at run time. Fields not named keep their values. A name the form does not have, a value a choice field does not offer, and a PDF with no form each fail the step, naming what is wrong — a renamed field never fails silently. With `flatten: true` the values become part of the page and the form is gone.

```yaml
- name: fillOnboarding
  type: pdf
  operator: fillForm
  props:
    file: { asset: forms/onboarding.pdf }
    fields:
      client_name: '{{trigger.data.company}}'
      accepts_terms: true
      plan: '{{trigger.data.plan}}'
    flatten: true
    output: { filename: 'onboarding-{{trigger.data.company}}.pdf' }
```

## Reading a PDF

`inspect` writes nothing. It returns `pages`; `pageSizes`, each page's `{ width, height, rotation }` in points as stored, rotation clockwise; `metadata`, the title, author, subject, keywords, creator, producer and dates the file declares, dates in ISO 8601; `encrypted`; and `formFields`, each `{ name, type, value?, options? }`, where `type` is `text`, `checkbox`, `radio`, `dropdown`, `list`, `button` or `signature`. An encrypted file is reported, not refused, so a later step can branch on it: its pages and sizes are read, its metadata and form are not.

## From pictures

`fromImages` lays each of `images` on its own page, in order. A JPEG or a PNG is embedded as it is; a WebP is converted on the way in; anything else fails the step, naming its position in the list. `pageSize` is `A4` (default), `A3`, `A5`, `Letter`, `Legal`, or `image` — each page exactly the size of its picture, one pixel to one point. `orientation` is `auto` (default: a wide picture gets a landscape page), `portrait` or `landscape`. `fit` is `contain` (default: the whole picture, centred, proportions kept), `cover` (the area filled, proportions kept, the overflow cut off) or `stretch`. `margin` keeps that many points of blank page around the picture; with `pageSize: image` it is added around the picture rather than taken from it.

## Failures

A step fails, and writes nothing, when an input is not a PDF (naming its position), when a range runs beyond the end of its file (naming the range and the page count), or when the file is encrypted — this family does not open password-protected PDFs; `inspect` reports them instead.
