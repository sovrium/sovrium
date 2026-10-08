# Bundle an App

> Package an app for deployment with `sovrium bundle`: one archive holding the config resolved and validated into JSON, the static files and the seed data — every entry checksummed.

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

| Entry              | Holds                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `manifest.json`    | The format, the engine version, the app's name and slug, the date, and every other entry with its size and sha256 |
| `project/app.json` | The config **resolved**: every `$ref` inlined, a TypeScript config evaluated — written as JSON, never as code     |
| `public/…`         | The static files `sovrium start` would serve, when the app has a `public/` directory                              |
| `seed/…`           | The `seed/<table>.yaml` files, when the app has a `seed/` directory                                               |

`project/app.json` is the document you wrote, with its references followed — not a copy with every default filled in, so the engine that boots it applies its own defaults. `$env.NAME` references stay references: no environment value is ever written into a bundle, and the `.env` file is never included.

The static files follow the same rules as `sovrium start`: `SOVRIUM_PUBLIC_DIR` points at another directory, and `SOVRIUM_PUBLIC_DIR=none` leaves them out.

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
  "entries": [{ "path": "project/app.json", "sha256": "a3f1c2…", "size": 2048 }]
}
```

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

It reads the archive stored at `objectKey`, reads its `manifest.json`, checks every file against the size and sha256 the manifest lists, and then validates the config the bundle carries exactly as `validateConfig` would. The step exposes `valid`, `name` (the app name in the manifest), `manifest` (`app`, `configHash`, `engineVersion`, `createdAt`) and `errors`. As with `validateConfig`, a bad bundle is a successful step reporting `valid: false` — an altered file is named (`project/app.json does not match its sha256`), a refused config comes with the validation report, an object that is not a bundle archive says so, and so does one that would unpack to more than 256 MiB — it is inflated as a stream and abandoned at that size, never unpacked whole. Only a key with nothing stored under it (or whose stored size cannot be read), or an object larger than 100 MiB stored, fails the step.
