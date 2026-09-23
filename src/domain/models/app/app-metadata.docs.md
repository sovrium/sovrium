# App Metadata

> The `name`, `version`, `description` and `badge` root properties — naming rules, Semantic Versioning, and the "Built with Sovrium" badge with its one-line removal.

Four scalar root properties shape your application's identity. Only `name` is required. The first three anchor the append-only version history; `badge` controls the attribution pill.

```yaml
name: '@acme/crm'
version: 2.1.0
description: 'A CRM workspace for managing contacts, deals, and tasks.'
badge: false # optional — removes the "Built with Sovrium" badge
```

## `name`

The app name follows npm package naming conventions: lowercase, URL-safe, and the only required property in the entire schema.

Scoped names are allowed — `@acme/dashboard` — and the whole string, scope included, is bounded at 214 characters. It may not begin with a dot or an underscore.

```yaml
name: '@acme/dashboard'
```

## `version`

A Semantic Versioning 2.0.0 string. Optional, but recommended: when present it labels the version history below.

```yaml
version: 1.0.0 # stable release
version: 2.0.0-beta.1 # pre-release
version: 1.0.0+build.42 # build metadata
```

A component with a leading zero — `01.0.0` — is rejected rather than normalised, because two spellings of one version would both appear in the history.

When `version` is omitted the startup banner displays `v1.0.0` in its place. That is **display only**: the property stays absent from the config API and from the published JSON Schema, so nothing downstream mistakes the placeholder for a declared version.

## `description`

A single-line description shown in the operator console and in metadata. It is also printed on its own row of the startup banner, directly under the line naming the app and its version.

Line breaks are rejected rather than stripped. The value is rendered on a single banner row and in single-line metadata slots, so accepting a newline would produce a broken layout somewhere the author never looked.

```yaml
description: 'Full-featured e-commerce platform with cart, checkout and payment processing'
```

## `badge`

A boolean controlling the **"Built with Sovrium"** badge — a small link pill rendered bottom-right on every page of your app. Shown by default.

| Value     | Behaviour                      |
| --------- | ------------------------------ |
| (omitted) | Badge shown — the default.     |
| `true`    | Badge shown, explicitly.       |
| `false`   | Badge removed from every page. |

```yaml
name: my-app
badge: false # removes the badge — one line, free, forever
```

The badge is server-rendered chrome with **zero telemetry**: a single static `<a>` linking to the project site — no beacon, no pixel, no client-side JavaScript. Its label follows the page's active locale, and the text itself is not customisable. It appears on app pages, the default homepage, error pages and standalone form pages, and is always absent from the operator console and from embedded form variants.

**Removing it is one line, it applies everywhere, and it will stay free.** It is never licence-gated. Keeping the badge is simply a way to support the project.

## Version history

Changes to these three identity properties are recorded append-only, so the history of what an app called itself — and at which version it said it — survives a redeploy rather than being overwritten by the current state.
