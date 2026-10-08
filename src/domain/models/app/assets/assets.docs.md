# Assets

> Ship private files with your config — templates, fonts, images, sample data — that actions read and no route ever serves.

`assets` lists files that live in the project directory beside the config. They are read once when the app starts and checked, then available to every action that reads a template or a file, by their path:

```yaml
assets:
  - path: templates/invoice.html
    description: Invoice layout, A4
  - path: templates/contract.docx
  - path: images/logo.png
  - path: fonts/Inter.woff2
  - path: templates/labels.tpl
    kind: html
```

An action names one with `{ asset: <path> }` — `template: { asset: templates/badge.svg }`, or a `pdf/merge` input `{ asset: legal/terms.pdf }`. Declaring a file is what makes it an asset: a file that merely sits beside the config cannot be read this way. Inside an HTML template, a relative URL equal to a declared path (`<img src="images/logo.png">`, `url(fonts/Inter.woff2)`) is served from the asset, so the render never reaches the network for it.

**No route serves an asset**: not the pages, not the public directory, and not the bucket file API. An asset therefore never sits inside the public directory: one whose real path — symbolic links followed — is inside it is refused, by `validate` for the `public/` directory beside the config, and when the app starts for the directory it serves, naming the path. That is the difference with `public/`, whose every file is downloadable. Files a business user replaces without a config change belong in a bucket instead (`template: { key, bucket }`).

<!-- sovrium:options AssetSchema -->

## Kinds

Each entry may declare a `kind`: `html`, `svg`, `css`, `partial`, `text`, `docx`, `xlsx`, `pptx`, `pdf`, `image`, `font` or `data`. Without one, the kind comes from the extension (`.html`, `.svg`, `.docx`, `.png`, `.woff2`, `.json`, …); a path whose extension implies no kind must declare one. Two kinds are read by templates rather than by actions: a `partial` (a `.hbs` file) is included by its path without the extension (`{{> partials/address}}`), and `data` (a `.json` or `.yaml` file) holds sample values for a template. When the app starts, and when `sovrium validate` reads the config, the declared kind is checked against the file's content, so a `.docx` that is really a renamed text file is refused before an automation trips on it.

## Size

An asset weighs at most **10 MB** (10 × 1024 × 1024 bytes; exactly 10 MB is accepted). Assets are read whole when the app starts, so a large brochure or a video belongs in a bucket.

## What is refused

Each of these is refused by `sovrium validate` and stops the app from starting, naming the entry:

- a path that is absolute, uses `\`, or contains a `..`, `.` or empty segment;
- a path whose file does not exist;
- a symbolic link that resolves outside the project directory;
- a file whose content does not match its kind;
- a file larger than 10 MB;
- the same path declared twice;
- an action naming an asset path the list does not declare.

## Sample data

A template asset may carry `sampleData`: the path of a declared data asset (`.json`, `.yaml`) or an object, shaped like the `data` of the action that reads it. `sovrium render` previews the template with it; an automation never reads it — a run renders only the values its step passes.

```yaml
assets:
  - path: templates/invoice-email.html
    sampleData: samples/invoice.json
  - path: samples/invoice.json
```

`validate` refuses a `sampleData` path no data asset declares, a data file that is not valid JSON or YAML, and `sampleData` on an asset that is not a template.
