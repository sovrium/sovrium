# Validation

> The two layers a table's data passes through — config-time decoding when the app boots, and per-write record checks.

Sovrium validates at two moments. **Config time**: the whole configuration is decoded with Effect Schema when the app starts, so a malformed table definition stops the boot rather than surfacing months later as a bad row. **Runtime**: every write is checked against the field rules, the CHECK constraints and the permissions in force.

## Field-level rules

Most of what a field validates comes from its own properties rather than from a separate rules block. The full set is on each field-type article; the summary below is what a reader usually needs.

| Rule                  | Applies to                                       | Effect                                                                                                                                                                          |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required`            | every field                                      | A value must be present on every record                                                                                                                                         |
| `unique`              | every field                                      | No two records may share the value                                                                                                                                              |
| `min` / `max`         | `integer`, `decimal`, `currency`, `percentage`   | The value falls within the inclusive range                                                                                                                                      |
| `precision`           | `decimal` (1–10), `currency`/`percentage` (0–10) | Restricts the number of decimal places                                                                                                                                          |
| `currency`            | `currency`                                       | A valid ISO 4217 three-letter code                                                                                                                                              |
| `maxLength`           | `rich-text`, `ai-summary`                        | Caps the character length. A `rich-text` write over the cap is refused; an `ai-summary` is TRUNCATED to it instead, because the model rather than the caller produced the value |
| `maxSelections`       | `multi-select`                                   | Caps the choices, and cannot exceed the option count                                                                                                                            |
| `options`             | `single-select`, `multi-select`, `status`        | Values come from the declared option list                                                                                                                                       |
| format                | `email`, `url`                                   | RFC 5322, and an absolute URL                                                                                                                                                   |
| `targetLanguage`      | `ai-translate`                                   | An ISO 639-1 code, optionally region-suffixed                                                                                                                                   |
| `categories` / `tags` | `ai-categorize` / `ai-tag`                       | At least two entries, with no duplicates                                                                                                                                        |

## What config-time decoding enforces

- Field names and field ids are unique within a table.
- Field and table names match `^[a-z][a-z0-9_]*` after sanitisation and stay within 63 characters.
- Index names and constraint names are unique within the table and match the same identifier pattern.
- A primary key names real fields.
- Indexes, permissions, views and webhooks name real fields.
- `count`, `rollup` and `lookup` name an existing `relationship` field in the same table.
- Formula fields reference fields that exist.
- Webhook names are unique, and a `payload` selector names a real field — the implicit `id` always counts as one.

Each of these is a decode error with a path, not a warning: the app does not start.

## Rules field properties cannot express

A CHECK constraint carries a SQL boolean expression, which is how a cross-field or conditional rule is stated.

```yaml
constraints:
  - { name: chk_end_after_start, check: 'end_date > start_date' }
  - { name: chk_active_members_have_email, check: '(is_active = false) OR (email IS NOT NULL)' }
```

## Uniqueness and integrity

- Single-field: `unique: true` on the field, or a top-level `unique: [{ fields: [slug] }]`.
- Composite: a top-level `unique: [{ fields: [tenant_id, slug] }]`, which becomes a unique index.
- Partial: a unique index carrying a `where` clause — a unique slug only among rows that are not soft-deleted, for instance.
- Relational: a `relationship` field creates its foreign key with `onDelete` and `onUpdate` actions; a reference spanning several columns is declared with `foreignKeys`.

## Check a configuration before deploying it

```bash
sovrium validate app.yaml
```

The same decoding the server does at boot, run against a file, so a broken configuration is caught where it is cheap to fix.
