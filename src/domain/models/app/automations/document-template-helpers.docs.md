# Document Template Helpers

> The helpers that exist only in the templates a document or email action renders — page breaks, pictures, QR codes and translations — plus partials and layouts, what changes in a Word template, and the reduced powers of a template stored in a bucket.

Everything in Template Helpers works here too: the same names, the same arguments, and the same escaping chosen by the output. This page covers what a document or email template adds on top, and the two places where it gives something up — a template read from a bucket, and a Word template.

## Documents and email templates

Four helpers exist for the templates a document or email action renders itself — its `template`, a PDF's `header` and `footer`, an email's `text` and a `subject` given as a template. Such a template that renders to more than `RENDERER_MAX_OUTPUT_BYTES` (50 MB by default) fails the step with `render_limit_exceeded`, and nothing is written. Outside such a template, in an ordinary action prop, `t` prints its key, and `pageBreak`, `image` and `qrcode` print nothing.

| Helper                                          | Does                                                                                                                                                                         | Example                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `pageBreak`                                     | Starts a new page in a PDF or a Word document; nothing in plain text                                                                                                         | `</section>{{pageBreak}}`               |
| `image source [width=…] [height=…] [x=…] [y=…]` | Places a picture, sized in pixels; one of `width` or `height` alone keeps the proportions; `x` and `y` place it in an SVG                                                    | `{{image "images/logo.png" width=120}}` |
| `qrcode value [size=…] [margin=…] [ecc=…]`      | Draws a QR code of the value. `size` is the whole square with its quiet zone, in pixels (200 by default), `margin` in modules (4), `ecc` one of `L`, `M` (default), `Q`, `H` | `{{qrcode ticket.code size=180}}`       |
| `t "key"`                                       | The key's translation in the step's language, escaped like any value; the key itself when no language defines it                                                             | `{{t 'invoice.title'}}`                 |

**`image`** takes one of two sources, and never a URL — a URL fails the step, naming the value, and nothing is fetched (a remote picture belongs in an `<img src>` under `allowRemoteAssets`):

- **a declared image asset**, by its path in the top-level `assets` list: `{{image "images/logo.png"}}`. The path is written in the template, or as a value of `data` the configuration writes out; a path that arrives with the run's data is refused, so a request cannot pick another declared asset — in a PDF's `header` and `footer` too;
- **a stored file**, named by a value of `data`. It must come from the configuration or from this run: a `{ key, bucket }` written in the step's `data`, or a file an earlier step of the same run produced (`{ step: renderBadge }`, or the key of a temporary file it wrote). A file reference that arrived with the run's data — a webhook body, a form submission — is refused, so a request can never make a document read a stored file of its choosing.

The picture is embedded in the output: inlined in HTML and SVG, attached to the message as an inline part in an email, a picture of that size in a Word document. A plain-text output prints nothing.

**`qrcode`** is drawn inside Sovrium: inline SVG in HTML and SVG, an inline picture in an email. A Word template cannot use it — the step fails, naming the helper; draw the code in an SVG or HTML template, or place a picture of it with `image`.

**`t`** reads `languages.translations`. The step's language is its `locale` prop, written as a declared language (`fr`) or read from the run (`'{{trigger.data.lang}}'`); without one, the default language. A key missing in that language falls back to `languages.fallback`, then to the default language. The same language drives the amounts, numbers and dates the formatting helpers print.

## Partials and layouts

An asset of kind `partial` (a `.hbs` file) is available to every document and email template by its path without the extension:

```handlebars
{{> partials/address customer}}
{{> partials/party who=customer role="client"}}

{{#> layouts/letter}}
  <p>Dear {{client.name}},</p>
{{/layouts/letter}}
```

A layout writes `{{> @partial-block}}` where the including template's content goes. A partial renders with the same data, the same helpers and the same escaping as the template that includes it. The name must be written in the template — a partial name computed from data is refused — and must be declared in `assets`: `validate` refuses an inline or asset template naming an undeclared partial, and a template stored in a bucket naming one fails the step. A partial that includes partials more than 10 levels deep fails the step.

## Word templates

A Word (`.docx`) template has every helper of Template Helpers and of this page except two:

- **partials and layouts** — `{{> …}}` and `{{#> …}}` fail the step;
- **`qrcode`** — fails the step, naming the helper.

`pageBreak`, `image` and `t` work as in any template, and every value is XML-escaped, so never add `escapeHtml`. Where a block tag such as `{{#each}}` may stand in a document — a table row, a run of paragraphs — is described under Word documents in Document Actions.

## Templates stored in a bucket

A template read from a bucket (`template: { key, bucket }`) is treated as written by whoever may upload to that bucket, so it renders with fewer powers:

- `regex`, `matchAll` and `log` are not available: a template calling one fails the step, naming the helper.
- Only the helpers of Template Helpers and of this page are called. A name that is no helper is read as a value, never invoked: bare (`{{total}}`) it renders that value, and with arguments it fails the step.
- It may include partials, but a partial is always read from the config's `assets`, never from a bucket.

Every other helper of those two pages works the same in a bucket template.
