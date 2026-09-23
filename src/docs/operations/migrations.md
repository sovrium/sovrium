# Schema Migrations

> Automatic schema evolution — Sovrium diffs your config against the database on boot, applies the migration in a transaction, validates checksums, and records a migration history.

Sovrium evolves your database schema automatically. It diffs the application configuration against the physical database, generates the appropriate SQL, and executes it inside a transaction — no hand-written migration files. The system validates checksums to detect drift, rolls back to recover from failures, and records a complete audit trail of every change.

Schema evolution runs at **boot**: when the configuration on disk differs from the database, Sovrium generates and applies the necessary SQL inside a transaction, then records the new schema version. Configuration is code-only, so you evolve the schema by editing your config file and re-deploying. There is no runtime schema-editing API, and `sovrium reload` refreshes a running server's config identity without applying schema changes.

Boot is not the only entry point. `sovrium migrate` brings a database forward **without** booting the app — no server, no port — so a platform can run migrations as a release phase, and a deploy that cannot boot still has a route to its own database. See **Migrating a Database** for its three modes.

## Automatic schema evolution

When the configuration differs from the database, Sovrium detects the change and applies the migration automatically, inside a transaction, so a partial failure rolls back cleanly.

```yaml
# Before
name: my-app
tables:
  - id: 1
    name: users
    fields:
      - { id: 1, name: email, type: email }
```

```yaml
# After — adding a phone field; Sovrium generates the ADD COLUMN
name: my-app
tables:
  - id: 1
    name: users
    fields:
      - { id: 1, name: email, type: email }
      - { id: 2, name: phone, type: single-line-text }
```

Three classes of change are tracked:

- **Structural** — adding, removing and renaming fields and tables.
- **Field property** — a type change, a constraint, a default, an options list, a `required` toggle.
- **Index and view** — adding and dropping indexes, creating and updating saved views.

Field IDs are the rename anchor — keep the `id` stable and change the `name` to rename a column without losing data. **Table Indexes & Constraints** and **Table Validation** document the per-field properties migrations track.

## Checksum validation

Sovrium fingerprints the schema to skip unnecessary migration work and detect drift.

1. On the first migration, Sovrium computes a checksum of the schema and stores it.
2. On each subsequent startup it compares the current schema's checksum against the stored one.
3. **Unchanged** — the server starts quickly, running no migrations.
4. **Changed** — Sovrium executes the necessary migrations and saves the new checksum.

This makes restarts cheap when nothing changed, and guarantees the database matches the declared schema when something did.

## Applying a schema change

Edit the config file and restart the server, or re-deploy. On the next boot Sovrium diffs the new configuration against the database and applies the migration in a transaction **before the app starts serving traffic**, so a newly declared table or column exists by the time its record routes are registered — routes never point at a table that does not yet exist. If the migration fails, the transaction rolls back and the server refuses to start on an inconsistent schema rather than serving a half-migrated database.

**Schema changes are code-only.** There is no runtime publish that mutates a live server's schema, and `sovrium reload` does not apply schema changes — it only refreshes the running server's config identity. The change reaches the database through one of two paths, and never through a running server: the boot-time migration above, or an explicit `sovrium migrate` ahead of it.

```bash
sovrium migrate app.yaml && sovrium start app.yaml
```

Splitting them keeps schema work out of the web process and gives a failed migration its own exit code, instead of a boot that dies with no explanation. `sovrium migrate` is idempotent, so every deploy can call it and only the ones with work to do will do any.

## Rollback

When a migration fails, the transaction rolls back and the schema is left in its prior consistent state. That is the only automatic rollback there is.

**Released migrations are forward-only**, and are never rewritten — a shipped migration file's checksum is pinned, and `sovrium migrate --check` reports a rewritten one as a condition that would abort the upgrade. So there is no down-migration to run, and recovering from a bad deploy means restoring a backup: the path in **Upgrade and roll back a Sovrium app**, the pre-upgrade backup alongside the prior binary. Take that backup before you migrate, not after.

## Audit trail

The migration system records, for each migration: the timestamp, the schema version number, the schema checksum, the complete schema snapshot, and any rollback operations with their reason.

This audit trail is the source of truth for "which schema produced this database" — cross-reference it against the activity log to correlate data changes with the schema version in force at the time.

## Error handling

Migrations fail loud and safe. Each of these aborts before or during execution and rolls back any partial work:

- **Invalid schema** — validation errors surface before any migration starts.
- **Migration failure** — a SQL execution error rolls back the transaction.
- **Connection error** — the database being unavailable aborts the run.
- **Constraint violation** — a foreign-key or unique-constraint failure rolls back.

## Related reading

- **Database Infrastructure** — the SQLite and PostgreSQL engines migrations target.
- **Table Indexes & Constraints** — the index and constraint definitions migrations apply.
- **Table Validation** — field- and table-level rules tracked across evolution.
- **Activity Monitoring** — the audit stream correlated against schema versions.
