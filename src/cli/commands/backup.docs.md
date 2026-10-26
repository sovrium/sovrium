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

### A PostgreSQL backup into PostgreSQL

When the archive holds a PostgreSQL dump, `DATABASE_URL` names the database to restore into and `psql` must be on `PATH`. The dump is replayed in one transaction: if `psql` stops on an error, the database is left as it was.

An empty database (one where only extensions are installed) restores without `--force`. A database that already holds tables is refused before `psql` runs:

```console
Error: DATABASE_URL names a PostgreSQL database that is not empty (it holds 6 tables, among them auth.user) — nothing was restored.
```

**`--force` replaces the app's data.** In the same transaction as the replay, it first drops the app's own objects: the `auth`, `drizzle` and `system` schemas, and every table, view, sequence, type and function in `public`. Objects an installed extension owns, such as `vector`, are kept, and so is every other schema. Use it to roll an app back to a backup, for instance after a failed upgrade: stop the server, put the previous release back, then run `sovrium restore <file> --force`.

### A SQLite backup into PostgreSQL

To move an install from SQLite to PostgreSQL, restore its SQLite backup with `DATABASE_URL` naming an **empty** PostgreSQL database. The summary reads `Database: SQLite backup → PostgreSQL`, and no SQLite database file is written: the rows now live in PostgreSQL.

Restore first brings the backup's SQLite copy forward with this engine's migrations (an archive from an older Sovrium is accepted), builds the PostgreSQL schema the way `sovrium migrate` does, then copies every row in one transaction: ids are kept, values are converted to their PostgreSQL types (instants read as UTC), and new records continue numbering after the highest id ever issued. Encrypted credentials are copied byte for byte, so they decrypt with the restored key; sessions keep working only with the same `AUTH_SECRET`. Deleted records stay deleted.

The database must hold no table, view or sequence (installed extensions such as `vector` are fine). Otherwise, even with `--force`, restore refuses before writing anything:

```console
Error: DATABASE_URL names a PostgreSQL database that is not empty (it holds 1 table, among them public.legacy_invoices) — nothing was restored.

Create a new, empty database, point DATABASE_URL at it, and run 'sovrium restore' again. A SQLite backup restores only into an empty PostgreSQL database; --force does not change that.
```

Building the schema reads the backup's config, so **a config written as code (`.ts`, `.mts`, `.js`, `.mjs`) is refused on this route**, before anything is written or run: no code from an archive runs during a restore. Restore it into SQLite first (unset `DATABASE_URL`; that runs no code), review the config and write it as YAML or JSON, take a new backup, and restore that one.

```console
Error: The backup's config project/app.ts is code, and a SQLite backup is restored into PostgreSQL only from a YAML or JSON config — nothing was restored.
```

The schema build runs in a child process that receives only the database URL, its own scratch directories and the system basics (`PATH`, `HOME`, `TMPDIR`, `TZ`, `LANG`, `DATABASE_POOL_MAX`, `NODE_EXTRA_CA_CERTS`) — none of your storage, mail, AI, auth or encryption secrets.

If anything fails once the PostgreSQL schema build has started — the build, a value that cannot be converted, or writing a file after the rows were copied — the restore names what stopped it and **empties the PostgreSQL database again**, so the advised retry is not refused. It removes only what it created: a schema the database already had (some hosts ship an `auth` schema of their own) is kept, and objects an extension owns are never touched. If the database cannot be emptied, for instance because another session holds a lock, the message says to recreate it before retrying.

Pressing Ctrl-C, or sending `SIGTERM`, interrupts the restore cleanly: the schema build is stopped, the database is emptied again, the temporary copy of the data is removed, and the command exits with `130` (or `143`) saying the restore was interrupted and nothing was restored. A second signal while that cleanup runs is ignored.

Uploaded files go where the restored server will look for them, read from the same storage variables it reads at boot:

- **No `STORAGE_PROVIDER`** (or the database one): a server on PostgreSQL keeps files in the database, so the uploads are loaded into it inside the same transaction as the rows, and nothing is written under `storage/`. The summary reads `Storage: 3 files (PostgreSQL database)`. Every file must have its file record and every record its file, otherwise the restore stops naming the file.
- **`STORAGE_PROVIDER=local`**: the files are written under `STORAGE_LOCAL_DIRECTORY` after the copy commits.
- **`STORAGE_PROVIDER=s3`**: the files are written to the local folder, and a warning says they were not uploaded to the bucket.

A PostgreSQL backup into SQLite is still refused.

### The key after a restore

If the backup was taken with `SOVRIUM_ENCRYPTION_KEY`, restore says so: set that variable to the same value before `sovrium start`. If the environment sets a key that differs from the restored key file, restore warns that the stored credentials will not decrypt while it is set.
