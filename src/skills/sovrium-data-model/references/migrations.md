# Changing a table that holds data

## Contents

- How Sovrium applies a change
- What is safe in place
- Expand → migrate → contract
- Renames
- Type changes
- Dropping a field or table
- Before you ship a change
- Seed data and migrations

Manual: `sovrium docs operations/migrations`, `sovrium docs cli-api/cli-migrate`, `sovrium docs cli-api/undo-and-reset`.

## How Sovrium applies a change

There are no hand-written migration files. At boot, or when you run `sovrium migrate`, Sovrium compares the config with the database, generates the SQL, and applies it in one transaction. A failure rolls back and the server refuses to start on a half-migrated schema. Released migrations are forward-only: there is no down-migration, so the way back from a bad deploy is the backup you took before it.

`sovrium migrate --dry-run` prints what would change without changing anything. Read it before every change to a populated table.

## What is safe in place

| Change                                    | Safe in one step?                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Add a table                               | Yes                                                                          |
| Add an optional field                     | Yes                                                                          |
| Add a required field to a populated table | Give it a `default` and read the dry run: existing rows have no value for it |
| Change a `label`, a description, a view   | Yes (no schema change)                                                       |
| Rename a field's `name`, keeping its `id` | Yes for the data; API clients using the old name break                       |
| Change a field's `type`                   | Check the dry run; plan expand → migrate → contract                          |
| Remove a field                            | Needs `allowDestructive: true`; data is deleted                              |

## Expand → migrate → contract

For anything that changes the shape of existing data, move in three separate changes:

1. **Expand**: add the new field (or table) next to the old one. Nothing reads it yet.
2. **Migrate**: copy the data (a one-off `sovrium seed --mode upsert` from an export, a manual automation, or the records API), then switch every reader — pages, automations, integrations — to the new field.
3. **Contract**: once nothing reads the old field, remove it in a later change, with `allowDestructive: true` and the owner's agreement.

Each step is deployable and reversible on its own. Never collapse the three into one edit.

## Renames

The field `id` is the rename anchor: keep the `id`, change the `name`, and the column keeps its data. Never delete a field and add a "new" one with the new name — that is a drop plus an add.

A rename still breaks anything that addresses the field by name: API clients, automation templates (`{{trigger.data.record.old_name}}`), page bindings. Search the config for the old name before and after.

## Type changes

A type change on a populated field may convert, truncate or clear values depending on the pair of types. Do not guess:

```
- [ ] sovrium migrate --dry-run shows what happens
- [ ] If the result is not obviously lossless, expand → migrate → contract instead
- [ ] Export the table first (records API or console export)
```

## Dropping a field or table

Dropping deletes data. It is refused unless the table sets `allowDestructive: true`, and over the config MCP it is also refused unless the person explicitly acknowledges data loss. Turn the flag on for the one change that needs it, confirm with the owner, then consider turning it off again.

## Before you ship a change

```
- [ ] Every field still has the same id it had before
- [ ] sovrium validate passes
- [ ] sovrium migrate --dry-run read and understood
- [ ] A backup exists (see sovrium docs guides-ops/backup-restore-sqlite for SQLite)
- [ ] Readers of any renamed field updated
- [ ] After start: the records API and one page show the migrated data
```

## Seed data and migrations

Seeds are for samples and reference data, not for migrating production data. `sovrium seed` writes directly and does **not** run automations. Keep `seed/<table>.yaml` in step with the fields, and run `sovrium seed --dry-run` after a rename: a seed that silently stopped matching the schema is worse than none.
