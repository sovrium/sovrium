# Measure an Install

> Print how many bytes an install holds — its database and its stored files — with `sovrium usage`, without changing anything.

`sovrium usage` reads the install a `sovrium start` would boot — same config, same `DATABASE_URL`, same storage variables, same data directory — and answers two figures: the bytes of its database and the bytes of its stored files. It writes nothing and applies no schema, so it is safe to run beside a live server.

```text
Usage: sovrium usage [config] [options]
```

```console
$ sovrium usage app.yaml
Database (sqlite): 24 KB
Files (local): 7 KB
```

`--json` prints the same figures as JSON, and `--report <file>` writes that JSON to a file and prints no figure, which is how a hosting machine reads it:

```json
{
  "database": "sqlite",
  "databaseBytes": 23580,
  "storage": "local",
  "filesBytes": 7300,
  "measuredAt": "2026-10-25T10:00:00.000Z",
  "unmeasured": []
}
```

## What is measured

| Install                     | `databaseBytes`                                     | `filesBytes`                                                   |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| SQLite (the default)        | The database file plus its write-ahead log, on disk |                                                                |
| PostgreSQL (`DATABASE_URL`) | `pg_database_size` of the database the URL names    |                                                                |
| Local storage               |                                                     | Every file under the storage directory; no link is followed    |
| S3 or database storage      |                                                     | The sizes Sovrium recorded for that store, summed in one query |

Files in an S3 bucket are not listed: the figure is the sum of the sizes Sovrium recorded when it stored them, read in one query whatever the bucket holds, with no request to the bucket and no egress. An object another tool put in the bucket is therefore not counted. `storage` names the store the figure covers: `local`, `s3` or `database`.

## A figure that cannot be measured

A figure Sovrium cannot read — a PostgreSQL server that does not answer, a storage directory it may not read — is `null`, never `0`, which would read as an empty database. It is listed in `unmeasured` with the reason, which carries no credential from the connection URL, and the command still succeeds with the other figure measured:

```json
{
  "database": "postgresql",
  "databaseBytes": null,
  "storage": "local",
  "filesBytes": 2048,
  "unmeasured": [
    {
      "figure": "databaseBytes",
      "reason": "the database could not be reached to measure its size (ERR_POSTGRES_CONNECTION_REFUSED)"
    }
  ]
}
```

Each figure is bounded in time — the connection and the query together — at 15 seconds: a database that accepts the connection and then never answers is reported as not measured, with a reason saying it timed out, and the other figure is still measured.

The environment is read exactly as `sovrium start` reads it, with the same defaults: with no storage variable, a SQLite install's files are under the data directory's `storage/` and a PostgreSQL install's are in the database. A setting `start` refuses — local storage naming no `STORAGE_LOCAL_DIRECTORY`, say — is refused here too, naming the variable, and nothing is measured. The command exits 1 then, or when the config file does not exist.

A supervising agent asks the same question of another app on its machine with the `instance/usage` automation step, which runs this command as that app.
