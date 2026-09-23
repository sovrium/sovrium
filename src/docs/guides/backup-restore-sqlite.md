# Back up and restore a Sovrium SQLite database

> Take a consistent backup of a Sovrium app running on the SQLite default, and restore it — one file holds all your data.

On the SQLite default, an app's rows live in one database file inside `SOVRIUM_DATA_DIR`, which is `./.sovrium/database.db` unless you move it. Copying that file is most of a backup — but do it consistently, because SQLite runs in WAL mode with side files, and copy the encryption key beside it.

## Take a consistent backup

Use SQLite's online backup so an in-flight write cannot corrupt the copy. No downtime is needed:

```bash
sqlite3 .sovrium/database.db ".backup '/backups/app-$(date +%F).db'"
cp .sovrium/encryption-key /backups/encryption-key
```

The second line is unnecessary if you set `SOVRIUM_ENCRYPTION_KEY` in the environment, because then no key file exists.

**The key is not inside the database.** `encryption-key` is a sibling file in the same data directory, and it is what decrypts stored connection credentials. Restore the database without it and every row comes back while the secrets in them stay unreadable — with no error to tell you why. If you set `SOVRIUM_ENCRYPTION_KEY` in the environment instead, that value is the thing to keep safe.

For a whole-directory snapshot — database, key and uploaded files — stop the server first, then copy `SOVRIUM_DATA_DIR` in full.

## Restore

Stop the app, replace the database file, and start again:

```bash
sovrium stop        # or systemctl stop / docker stop
cp /backups/app-2026-07-20.db .sovrium/database.db
cp /backups/encryption-key .sovrium/encryption-key      # only if the original key is gone
rm -f .sovrium/database.db-wal .sovrium/database.db-shm
sovrium start app.yaml
```

## Verify

The startup summary reports the SQLite database, and your records are back. Automate the backup command with cron for off-site copies.

## Next

- **Database Infrastructure** — the SQLite defaults and `SOVRIUM_DATA_DIR`.
- **Connect Sovrium to PostgreSQL** — when you outgrow single-file backups.
- **GDPR & Privacy** — data export and erasure obligations.
