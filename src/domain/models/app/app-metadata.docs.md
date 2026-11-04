# App Metadata

> The `name`, `displayName`, `version`, `description` and `badge` root properties: naming rules, the name people read, Semantic Versioning, and a pointer to the badge's own article.

Five scalar root properties shape your application's identity. Only `name` is required. `name`, `version` and `description` anchor the append-only version history; `displayName` is the name people read; `badge` controls the attribution pill.

```yaml
name: '@acme/crm'
displayName: Acme CRM # optional: the name people read
version: 2.1.0
description: 'A CRM workspace for managing contacts, deals, and tasks.'
badge: false # optional: removes the "Built with Sovrium" badge
```

## `name`

The app name follows npm package naming conventions: lowercase, URL-safe, and the only required property in the entire schema.

Scoped names are allowed (`@acme/dashboard`), and the whole string, scope included, is bounded at 214 characters. It may not begin with a dot or an underscore.

```yaml
name: '@acme/dashboard'
```

## `displayName`

The name people read, where `name` stays the identifier: `Acme CRM` for an app named `acme-crm`, `Café Dupont` for `cafe-dupont`. Capitals, spaces, accents and apostrophes are all accepted: everything `name` refuses because it also has to work in an address.

```yaml
name: acme-crm
displayName: Acme CRM
```

It is what the app's chrome prints: the operator console's sidebar and breadcrumb, the sign-in card, the default home page's heading and title, and `$app.label` in a page's text. `$app.name` still prints `name`.

One line, at most 100 characters, neither blank nor starting or ending with a space. Optional: without it, each of those surfaces prints what it printed before the key existed: `name` exactly as declared, or for `$app.label` the name in title case (`acme-crm` → `Acme Crm`).

## `version`

A Semantic Versioning 2.0.0 string. Optional, but recommended: when present it labels the version history below.

```yaml
version: 1.0.0 # stable release
version: 2.0.0-beta.1 # pre-release
version: 1.0.0+build.42 # build metadata
```

A component with a leading zero, such as `01.0.0`, is rejected rather than normalised, because two spellings of one version would both appear in the history.

When `version` is omitted the startup banner displays `v1.0.0` in its place. That is **display only**: the property stays absent from the config API and from the published JSON Schema, so nothing downstream mistakes the placeholder for a declared version.

## `description`

A single-line description shown in the operator console and in metadata. It is also printed on its own row of the startup banner, directly under the line naming the app and its version.

Line breaks are rejected rather than stripped. The value is rendered on a single banner row and in single-line metadata slots, so accepting a newline would produce a broken layout somewhere the author never looked.

```yaml
description: 'Full-featured e-commerce platform with cart, checkout and payment processing'
```

## `badge`

`badge` controls the "Built with Sovrium" link pill every page carries: shown by default, moved into a footer line with `badge: { placement: footer }`, removed with `badge: false`. It has its own article, [Built with Sovrium Badge](/en/docs/badge), with the placement rules and where the badge does and does not appear.

## Version history

Changes to these three identity properties are recorded append-only, so the history of what an app called itself, and at which version it said it, survives a redeploy rather than being overwritten by the current state.
