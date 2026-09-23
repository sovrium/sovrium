# Schema Overview

> The root properties of a Sovrium app config — what each one declares, how they are validated together, and the three formats you can write them in.

A Sovrium app is one declarative configuration object. Only `name` is required; everything else is optional. That lets an app grow in steps — from a single identifier to a full-stack application — without rewriting what came before.

## Root properties

<!-- sovrium:options AppSchema depth=1 -->

Every property above is documented beside the schema that declares it, so the options you read are the options this binary accepts.

## A config grows one property at a time

```yaml
name: my-app # the only required property
version: 1.0.0
description: My application

tables: # data models
  - id: 1
    name: tasks
    fields:
      - { id: 1, name: title, type: single-line-text }

pages: # server-rendered pages
  - { name: Home, path: /, components: [...] }

auth: # accounts, roles and sessions
  strategies: [email-password]
```

Adding a property never invalidates what was already there. That is the point of the shape: an app that starts as a table and a page becomes an app with forms, automations and agents by adding blocks, not by migrating a structure.

## Configuration formats

YAML, JSON and TypeScript are all accepted. YAML reads best by hand; JSON suits programmatic generation; TypeScript adds type checking against the declaration `sovrium types` writes into your project — with no package to install, because the declaration comes out of the binary.

```yaml
name: my-app
version: 1.0.0
tables:
  - id: 1
    name: tasks
    fields:
      - { id: 1, name: title, type: single-line-text }
```

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "tables": [
    {
      "id": 1,
      "name": "tasks",
      "fields": [{ "id": 1, "name": "title", "type": "single-line-text" }]
    }
  ]
}
```

A large config can be split across files with `$ref`, which resolves before validation — so a split config is validated as the single object it assembles into, and an error names the property rather than the file.

## Cross-section validation

Root sections are validated **together**, not in isolation. A config is refused before the server starts when, for example:

- a `user`, `created-by` or `updated-by` field exists but `auth` is not configured;
- a table or bucket permission names a role that is not declared;
- an attachment field references a `bucket` that `buckets` does not declare;
- a page, form or redirect path collides with a reserved prefix.

This is why a config either boots or is refused with a path, rather than booting into a surface that fails on first use. A reference that cannot resolve is a decode error, not a runtime one.

## Unknown properties are refused

A property no schema declares is an error, not an ignored key. A silently accepted typo is the failure mode this rule exists to remove: `tabels:` would otherwise validate, boot, and serve an app with no tables in it — and nothing anywhere would say why.
