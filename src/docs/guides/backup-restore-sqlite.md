# Back up and restore a Sovrium SQLite database

> Take a consistent backup of a Sovrium app running on the SQLite default with one command, and restore it on any machine — database, encryption key, config and uploads together.

On the SQLite default, an app's rows live in one database file inside `SOVRIUM_DATA_DIR` (`./.sovrium/database.db` unless you move it), beside the key that encrypts its stored credentials and the files people uploaded. `sovrium backup` writes all of it, plus the config tree, into one archive.

## Take a backup

From the project directory, while the app keeps running:

```bash
sovrium backup app.yaml --output /backups/app-$(date +%F).tar.gz
```

```console
Backup written to /backups/app-2026-10-06.tar.gz (5 files, 48 KB).
The .env file is not in the backup: keep its secrets in your own secret store.
```

The database is copied with SQLite's own online backup, so an in-flight write cannot corrupt the copy and no downtime is needed. Without `--output`, the archive lands in the current directory with a dated name. Schedule the command with cron and move the archive off the machine — encrypted, as below.

**The key is not inside the database.** `encryption-key` is a sibling file in the same data directory, and it is what decrypts stored connection credentials. Restore the database without it and every row comes back while the secrets in them stay unreadable — with no error to tell you why. `sovrium backup` archives the key file for this reason. If you set `SOVRIUM_ENCRYPTION_KEY` in the environment instead, no key file exists and none is archived: that value is the thing to keep safe, and the command reminds you.

The `.env` file is never archived. Keep its secrets in your own secret store.

**The archive is a master credential.** It holds all your data and, in the key-file setup, the key itself: whoever has it can decrypt every stored credential and, unless you set `AUTH_SECRET` separately, sign in as any user. Encrypt it before it leaves the machine (`age` or `gpg` both work), keep it where only you can read it, and never on a shared drive.

## Restore

From the directory the project should live in:

```bash
sovrium stop                                   # if a server runs on this data directory
sovrium restore /backups/app-2026-10-06.tar.gz
sovrium start app.yaml
```

`sovrium restore` writes the config tree into the current directory and the database, key and uploads into the data directory (`--data-dir`, else `SOVRIUM_DATA_DIR`, else `./.sovrium`). It refuses — with nothing written — while a server is running there, over a data directory that is not empty or a config file that already exists (pass `--force` to replace them), and on any entry whose checksum does not match. Every checksum is verified before the first write.

## Verify

`sovrium restore` prints what it restored and `Checksums: <n> of <n> verified`. The startup summary of the next `sovrium start` reports the SQLite database, your records are back, and connections authorised before the backup still work, because the restored key decrypts their stored tokens.

## Next

- **Back Up and Restore** — every option, the archive layout and each refusal.
- **Database Infrastructure** — the SQLite defaults and `SOVRIUM_DATA_DIR`.
- **Connect Sovrium to PostgreSQL** — `sovrium backup` dumps it with `pg_dump`.
- **GDPR & Privacy** — data export and erasure obligations.
