# Bundle an App

> Package an app for deployment with `sovrium bundle`: one archive holding the config resolved and validated into JSON, the static files, the seed data and the files its pages read — every entry checksummed.

A deployment target should not have to run your TypeScript, chase your `$ref` files or guess which files belong to the app. `sovrium bundle` does that work once, on your machine, and writes the result into one gzipped tar a host can verify before it trusts anything.

## `sovrium bundle`

```text
Usage: sovrium bundle [config] [options]
```

```bash
sovrium bundle                                  # app.ts, app.yaml… in the current directory
sovrium bundle app.ts --output dist/crm.tar.gz
```

```console
$ sovrium bundle app.ts --output dist/crm.tar.gz
Bundle written to dist/crm.tar.gz (6 files, 41 KB).
```

Without `--output`, the archive lands in the current directory as `sovrium-bundle-<app>-<YYYYMMDD>-<HHMMSS>.tar.gz`, where `<app>` is the app name made URL-safe (`@atelier/crm` becomes `atelier-crm`).

### Validated first, or not at all

The config is read and validated exactly as `sovrium validate` reads and validates it. A config that does not validate prints the same report, exits `1`, and writes nothing — a bundle that exists is a bundle the engine accepted.

### What the archive holds

| Entry               | Holds                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`     | The format, the engine version, the app's name and slug, the date, and every other entry with its size and sha256                                                                                  |
| `project/app.json`  | The config **resolved**: every `$ref` inlined, a TypeScript config evaluated — written as JSON, never as code                                                                                      |
| `public/…`          | The static files `sovrium start` would serve, when the app has a `public/` directory                                                                                                               |
| `seed/…`            | The `seed/<table>.yaml` files, when the app has a `seed/` directory                                                                                                                                |
| `project/<path>`    | Each file the config declares under `assets`, at the path it declares, beside `project/app.json`                                                                                                   |
| `project/<path>`    | Each markdown file a page reads — the files a `contentDir` matches, the file a `markdown.file` names, and a page's `source.file` when it is a `.md` file — at its path from the config's directory |
| `project/CLAUDE.md` | The project's `CLAUDE.md`, the brief an AI reads first, when one sits beside the config                                                                                                            |
| `project/PROMPT.md` | The project's `PROMPT.md`, the first prompt to give that AI, when one sits beside the config                                                                                                       |

`project/app.json` is the document you wrote, with its references followed — not a copy with every default filled in, so the engine that boots it applies its own defaults. `$env.NAME` references stay references: no environment value is ever written into a bundle, and the `.env` file is never included.

The static files follow the same rules as `sovrium start`: `SOVRIUM_PUBLIC_DIR` points at another directory, and `SOVRIUM_PUBLIC_DIR=none` leaves them out.

The private files declared under `assets` travel too, so an email template or a document model the config reads is there when the app starts: `templates/invoice.html` is written to `project/templates/invoice.html`, where the unpacked config finds it. They are checked first, exactly as `sovrium validate` checks them — a declared file that is missing, outside the project or inside `public/` stops the bundle with its name, and nothing is written. An asset declared as `app.json` is refused, since that name is the config's own entry. An engine older than 0.38 refuses a bundle that carries an asset when it reads its manifest; a bundle without one is unchanged.

The markdown a page reads from disk travels the same way. Every file a page's `contentDir` matches — its `directory` expanded by `include`, `**/*.md` when none is set — and the file a `markdown.file` names, or a page's `source.file` that ends in `.md`, are written under `project/`, at their path from the config's directory, so `content/docs/en/intro.md` becomes `project/content/docs/en/intro.md` and an unpacked bundle renders the same articles and serves the same `/feed.xml` as its source. Only the files `include` matches are carried, and a file two pages read, or that is also declared under `assets`, is carried once. A path that is absolute or leads outside the config's directory stops the bundle with its name, as does one that would be written over `project/app.json`, and nothing is written. A `source.file` with another extension is not markdown to the renderer, so the bundle neither carries nor checks it. A `contentDir` directory that does not exist yet is not an error: the page carries no file, as `sovrium start` serves it with none. A `markdown.file` that names a file that does not exist is not an error either, but it is told: the bundle prints one warning naming the page and the path, carries nothing for that page, still writes the archive and exits `0` — the same warning `sovrium validate` prints.

Unpacked, a bundle runs as it is: `sovrium start <root>/project/app.json` serves `<root>/public/` and `sovrium seed <root>/project/app.json` reads `<root>/seed/`, unless `SOVRIUM_PUBLIC_DIR` (or `none`) or `--dir` says otherwise. Sovrium recognises an unpacked bundle by its config sitting at `project/app.json` with `manifest.json` one level up.

A `CLAUDE.md` and a `PROMPT.md` beside the config make the bundle a starter: both travel byte for byte, and `sovrium init --from-bundle` puts them back at the root of the project it opens, for the person and the AI that will edit it. A project without them carries neither.

A `$ref` target outside the config's directory is refused, so a bundle never carries a file from beyond the project you meant to ship.

### The manifest

```json
{
  "format": "sovrium-bundle",
  "formatVersion": 1,
  "engine": { "minVersion": "0.32.0" },
  "app": { "name": "@atelier/crm", "slug": "atelier-crm" },
  "configHash": "a3f1c2…",
  "createdAt": "2026-10-08T09:15:00.000Z",
  "entries": [{ "path": "project/app.json", "sha256": "a3f1c2…", "size": 2048 }],
  "containsDemoData": true
}
```

`containsDemoData` is `true` when the archive carries `seed/` files, so whoever opens the bundle knows there is demo data to load before unpacking anything. A bundle with no `seed/` file leaves the field out. It is optional, so `formatVersion` stays `1` and an older reader ignores it.

`configHash` is the sha256 of `project/app.json`, so two bundles of the same resolved config compare equal however they were written. `engine.minVersion` is the version that validated the config: a host running an older engine should refuse the bundle rather than guess.

It is an ordinary `.tar.gz`: `tar -xzf` opens it on any machine, and `sovrium validate project/app.json` re-checks the config it carries.

### Checking a stored bundle

An app that receives deployments — archives written by `sovrium bundle` and uploaded to its storage — checks one with the `validateBundle` operator before anything applies it:

```yaml
automations:
  - name: check-upload
    trigger:
      type: webhook
      method: POST
    actions:
      - name: checkBundle
        type: sovrium
        operator: validateBundle
        props:
          objectKey: '{{trigger.data.objectKey}}'
```

It reads the archive stored at `objectKey`, reads its `manifest.json`, checks every file against the size and sha256 the manifest lists, and then validates the config the bundle carries exactly as `validateConfig` would. The step exposes `valid`, `name` (the app name in the manifest), `manifest` (`app`, `configHash`, `engineVersion`, `createdAt`) and `errors`. As with `validateConfig`, a bad bundle is a successful step reporting `valid: false` — an altered file is named (`project/app.json does not match its sha256`), a refused config comes with the validation report, an object that is not a bundle archive says so, and so does one that would unpack to more than 256 MiB — it is inflated as a stream and abandoned at that size, never unpacked whole. Only a key with nothing stored under it (or whose stored size cannot be read), or an object larger than 100 MiB stored, fails the step. In a run someone started by hand, `objectKey` is read as its starter may read it: a file stored in a table field's bucket, or in a bucket she may not download, fails the step with `Resource not found`, exactly as a key nothing holds does. A bundle written to the store with no catalog row, as the control plane writes its deploys, is read as before; a starter with the admin role reads every key.
