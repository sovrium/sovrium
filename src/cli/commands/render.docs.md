# Previewing a Template

> `sovrium render` renders one template asset the way an automation would, with its sample data or yours, and prints it or writes it to a file — offline, with no server and no database.

```text
Usage: sovrium render <asset> [--data <file>] [--out <file>] [--email] [--locale <code>] [--config <file>]
```

A template is easiest to get right when you can see it filled. `sovrium render` takes the path of a template declared in `assets`, fills it with the same engine an automation step uses — the same escaping, helpers, partials, translations and render rules — and shows you the result.

```bash
sovrium render templates/invoice.html                       # with the asset's sampleData
sovrium render templates/invoice.html --data order.json     # with these values (JSON or YAML)
sovrium render templates/invoice.html --out invoice.pdf     # through the browser engine
sovrium render templates/contract.docx --out contract.docx  # a Word template renders to a file
sovrium render templates/invoice-email.html --email         # as email/send delivers it
sovrium render templates/letter.html --locale fr            # in another declared language
```

## The values

`--data` names a JSON or YAML file holding an object of values, shaped like the `data` of the step that renders the template. Without it, the asset's `sampleData` is used; with neither, the template renders with empty values and a notice says so on stderr. A value that contains markup is escaped exactly as in a run, so what you see is what a customer would receive.

## The output

The config is the one in the current directory (`app.yaml`, `app.yml`, `app.ts` or `app.json`), or `--config <file>`. Without `--out`, an HTML, SVG or text template prints to stdout. With `--out`, the render is written to that file and nothing is printed, and the file's extension picks the format:

| Template | Writes to                                                           |
| -------- | ------------------------------------------------------------------- |
| HTML     | `.html`; `.pdf` or `.png` through the browser engine (`RENDERER_*`) |
| SVG      | `.svg`; `.png`, `.jpeg` or `.webp`, drawn inside Sovrium            |
| Text     | `.txt`                                                              |
| Word     | `.docx`; `.pdf` through the office engine (`OFFICE_*`)              |
| Excel    | `.xlsx`                                                             |

A Word or Excel template always needs `--out`. Any other combination is refused, naming the formats the template renders to. A PDF or picture of an HTML template needs the browser engine: without one, `render` exits 1 with `renderer_unavailable`, naming the variable to set.

`--email` prints an HTML template as `email/send` delivers it: its `<style>` rules inlined onto the elements they match, cleaned by the email sanitizer, and no `<style>` block left. `--locale` renders in another declared language — its translations, and its formatting of dates, numbers and amounts.

## What it never does

`render` starts no server, opens no port, reads no database and runs no automation, so it works with the app stopped and the database unreachable. A picture a value names from a bucket is not read either: preview with declared image assets.

A path that names no template asset exits 1, listing the templates the config declares.
