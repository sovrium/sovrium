# Back Up and Restore

> Write everything an install needs into one archive with `sovrium backup`, and put it back on any machine with `sovrium restore` — the key that decrypts your stored credentials travels with the rows.

Two commands, one archive. `sovrium backup` reads the install a `sovrium start` would boot — same config, same `DATABASE_URL`, same data directory — and writes a single gzipped tar. `sovrium restore` is its inverse, and checks everything before it writes anything.

## `sovrium backup`

```text
Usage: sovrium backup [config] [options]
```

```bash
sovrium backup                                   # app.yaml in the current directory
sovrium backup app.yaml --output /backups/atelier-2026-10-06.tar.gz
```

```console
$ sovrium backup app.yaml --output /backups/atelier-2026-10-06.tar.gz
Backup written to /backups/atelier-2026-10-06.tar.gz (5 files, 48 KB).
The .env file is not in the backup: keep its secrets in your own secret store.
```

Without `--output`, the archive lands in the current directory as `sovrium-backup-<app>-<YYYYMMDD>-<HHMMSS>.tar.gz`. The server can keep running: the SQLite copy is taken online with SQLite's own `VACUUM INTO`, which is consistent under write-ahead logging and needs no downtime.

### What the archive holds

| Entry                  | Holds                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `manifest.json`        | Engine version, dialect, date, what was left out, and every other entry with its size and sha256            |
| `database/database.db` | SQLite: a consistent copy of the database                                                                   |
| `database/dump.sql`    | PostgreSQL: a plain-SQL dump made by `pg_dump`                                                              |
| `encryption-key`       | The data directory's key file, when the key lives there                                                     |
| `project/…`            | The config file and every `$ref` target it reaches, at their paths relative to the config's directory       |
| `storage/…`            | Uploaded files, when storage is local. S3 and database-stored files are counted in the manifest, not copied |

It is an ordinary `.tar.gz`: `tar -xzf` opens it on any machine, with or without Sovrium.

**The `.env` file is never included.** An archive is the file most likely to end up on a shared drive, so the secrets in `.env` stay in your own secret store. The manifest's `excluded` list records the omission and the command says so on stderr.

**Treat the archive as a master credential.** It holds every row of your data and, when the key lives in the data directory, the `encryption-key` file. With that key, whoever holds the archive can decrypt every stored credential and — unless `AUTH_SECRET` is set separately — sign a session as any user, admins included. Encrypt the archive before it leaves the machine (with `age` or `gpg`, for example), restrict who can read it, and never put it on a shared drive.

The archive is written readable by your account only (mode `0600`).

**A key from the environment is never written into the archive.** When `SOVRIUM_ENCRYPTION_KEY` supplies the key, the manifest names the variable instead and the command reminds you to keep that value safe. Restoring without it brings every row back while the credentials in them stay unreadable.

A `$ref` target outside the config's directory is refused rather than flattened, because it could not be restored to the same place.

### PostgreSQL needs the client tools

On PostgreSQL the dump is made by `pg_dump`, and a restore replays it with `psql`. Without `pg_dump` on `PATH` the backup refuses before it connects to anything:

```console
$ sovrium backup app.yaml
Error: The PostgreSQL client tool pg_dump is not on PATH, so the database cannot be dumped — nothing was written.

Install the PostgreSQL client tools (pg_dump and psql), then run 'sovrium backup' again.
```

Files stored in the database travel inside the dump; files in an S3 bucket are listed with their count, and the bucket itself is backed up with your storage provider.

## `sovrium restore`

```text
Usage: sovrium restore <file> [options]
```

Run it from the project directory. The config tree goes into the current directory; the database, the key and the uploads go into the data directory — `--data-dir` when given, else `SOVRIUM_DATA_DIR`, else `./.sovrium`. The key is written readable by its owner only.

```console
$ sovrium restore /backups/atelier-2026-10-06.tar.gz
Restored the backup taken on 2026-10-06 by Sovrium v0.29.1.

  Database: SQLite (/srv/atelier/.sovrium/database.db)
  Encryption key: /srv/atelier/.sovrium/encryption-key
  Config: 2 files (/srv/atelier)
  Storage: 1 file (/srv/atelier/.sovrium/storage)
  Checksums: 5 of 5 verified
```

The next `sovrium start` boots on what was restored and decrypts the credentials stored before the backup. An archive from an older Sovrium is accepted: that start brings the schema forward.

### Refusals

Each refusal exits `1` with `— nothing was restored.` and writes nothing. They are checked in this order:

| Refused                                                                            | Way forward                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| The file is not a Sovrium backup                                                   | Pass an archive written by `sovrium backup`                    |
| The backup was taken by a newer Sovrium                                            | Restore it with that version or later (`sovrium update`)       |
| A server is running on the data directory                                          | Stop it with `sovrium stop` — `--force` does not override this |
| The data directory is not empty, or a config file the archive holds already exists | Pass `--force` to replace them                                 |
| An entry does not match its sha256                                                 | Restore from another copy; the archive is damaged              |

**Every checksum is verified before the first write**, so a damaged archive never leaves half a restore behind. The running-server check reads the same lock file `sovrium stop` does, and `--force` deliberately cannot override it: overwriting a live database file is corruption, not a convenience.

`--force` replaces the database, the key, the archived config files and the whole local storage directory, and removes a stale write-ahead log beside the replaced database.

When the archive holds a PostgreSQL dump, `DATABASE_URL` must name the empty PostgreSQL database to restore into and `psql` must be on `PATH`; the dump is replayed in one transaction.

### The key after a restore

If the backup was taken with `SOVRIUM_ENCRYPTION_KEY`, restore says so: set that variable to the same value before `sovrium start`. If the environment sets a key that differs from the restored key file, restore warns that the stored credentials will not decrypt while it is set.
