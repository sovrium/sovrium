# Upgrade and roll back a Sovrium app

> Move a Sovrium app to a new version safely — back up first, let the boot-time migration run, and roll back by restoring the backup with the prior binary.

Schema migrations are **forward-only**: a released migration is never rewritten, and there is no automatic downgrade. So a safe upgrade always pairs with a backup you can restore.

## Upgrade

Back up first — the SQLite file, or a database snapshot on PostgreSQL — then move to the new version and restart. The schema migration runs on boot, inside a transaction, before the app serves traffic:

```bash
sqlite3 .sovrium/database.db ".backup '/backups/pre-upgrade.db'"
sovrium update            # binary install; or: docker pull ghcr.io/sovrium/sovrium:latest
sovrium stop && sovrium start app.yaml
```

If the migration fails, the transaction rolls back and the server refuses to start on an inconsistent schema — you are never left half-migrated.

## Roll back

Because migrations do not reverse, a rollback restores the pre-upgrade data alongside the prior binary or image:

```bash
sovrium stop
curl -fsSL https://sovrium.com/install | sh -s -- --version 0.24.0   # the version you upgraded from
cp /backups/pre-upgrade.db .sovrium/database.db
rm -f .sovrium/database.db-wal .sovrium/database.db-shm
sovrium start app.yaml
```

For **zero downtime**, run the new version as a second instance behind your proxy, verify it, then switch traffic — keeping the old instance until you are confident.

## Next

- **Schema Migrations** — why released migrations are immutable.
- **Back up and restore SQLite** — the backup this guide relies on.
- **CLI Overview** — `update`, `stop` and `start`.
