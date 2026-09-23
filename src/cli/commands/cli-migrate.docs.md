# Migrating a Database

> Bring a database's schema forward without booting the app — with `--dry-run` to preview and `--check` as a pre-flight.

Sovrium normally migrates your database as part of starting the server. `sovrium migrate` separates the two: it brings the schema forward and exits, starting no server and binding no port.

```text
Usage: sovrium migrate [config] [options]
```

That separation buys two things. A platform can run migrations as a **release phase** instead of inside the web process. And when a deploy will not boot, you still have a route to its own database — the command constructs no application runtime, so it stays available where `sovrium start` cannot complete.

All it needs is the connection: `DATABASE_URL` for PostgreSQL, or nothing at all for the embedded SQLite. A config path is accepted, and auto-discovered when omitted, exactly as `start` does it.

## Three modes

- **`sovrium migrate [config]`** — bring this database forward. Exit `0` applied, `1` failed.
- **`sovrium migrate --dry-run`** — what _would_ change? Exit `0` unless refused.
- **`sovrium migrate --check`** — is this database safe to upgrade? Exit `0` safe, `1` unsafe.

`--dry-run` and `--check` both write nothing, and cannot be combined: they ask different questions, and running them together would blur which answer you got.

## What it migrates

"Migration" names two independent systems, and this command owns both.

- **The shipped migrations** — the migration files bundled with the binary, covering authentication, system and internal tables, decided by the migration journal recorded in your database.
- **The config tables** — the `tables` in your configuration, covering your own tables, views and indexes, decided by a checksum of your table definitions.

The shipped migrations run **first**, always. A `user` field emits a real foreign key into the authentication tables, so your own tables cannot be created before the migrations that build them. Running only half would leave `sovrium start` doing schema work inside the web process — the coupling this command exists to break.

## Applying

```bash
sovrium migrate app.yaml
```

```text
  Dialect: sqlite
  Migrations: /srv/app/drizzle/sqlite

  ✓ Applied 14 pending migrations. The journal is at 14 of 14.
    0000_mute_cassandra_nova
    …
    0013_jazzy_karma

  ✓ Config tables reconciled: notes.
```

Each migration is named, and the journal position is reported as a fraction, so "applied nothing" and "applied fourteen" never look alike from outside.

The command is **idempotent**. Run it over a database that is already current and it applies nothing and exits `0`. That is what makes it safe as a deploy hook: every deploy can call it, and only the ones with work to do will do any.

## Previewing with `--dry-run`

Names every pending migration and every statement it would run against your own tables, and writes nothing:

```text
  ⚠ Dry run — nothing was written.

  would apply 14 pending migration(s)
    0000_mute_cassandra_nova
    …

  would create table notes
    CREATE TABLE IF NOT EXISTS notes (…)

  Re-run without --dry-run to apply this plan.
```

A few changes rebuild a table and copy its rows across. The exact statements for those depend on the state of the table at the moment they run, so they cannot be rendered in advance. They are **named and labelled as unsimulated rather than left out** — a preview that quietly under-reports is worse than none, because you use it to decide whether the change needs a maintenance window.

## Pre-flight with `--check`

Reports where the database stands — which engine, which migration folder, how much of the journal it has applied — then gives a verdict. On a database already at the current schema the verdict reads `No pending migrations. This database is at the current schema.`, also exit `0`.

Exit `1` means the upgrade would abort part-way through, for one of three reasons:

- **Duplicate account identities** — two authentication rows a later migration's uniqueness constraint cannot both keep.
- **Duplicate OAuth client ids** — the same collision on the OAuth server's clients.
- **A rewritten released migration** — a migration file whose stored checksum no longer matches the file this build ships.

Each is reported with the offending rows named. Nothing is repaired automatically: deleting one of two colliding authentication rows would sever somebody's login, so the command names them and stops, and you decide which one survives.

**`--check` is a pre-flight, not a guarantee.** It reports the conditions it can prove would block the upgrade. A clean report means none of those were found — not that the migration will succeed.

## In a deploy pipeline

```bash
sovrium migrate app.yaml && sovrium start app.yaml
```

Splitting them keeps schema work out of the web process, and gives a failed migration its own exit code instead of a boot that dies with no explanation. Pair it with `--check` in CI, ahead of the deploy, to learn about a blocked upgrade before you take traffic down.

## What it does not do

**It does not roll back.** Released migrations are forward-only and are never rewritten. Recovering from a bad upgrade means restoring a backup.

**It does not write any data.** Migrations shape the schema; rows come from `sovrium seed` or from the app itself. It also skips the best-effort work boot does after the schema is in place, so that a command named `migrate` has no side effects its name does not promise.

**It does not replace a correct boot.** `sovrium start` still migrates on its own. This command makes a broken upgrade recoverable and a deploy pipeline explicit; it is a route to the database, not a repair of the boot sequence.
