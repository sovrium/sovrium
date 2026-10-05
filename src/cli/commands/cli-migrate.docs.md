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
- **`sovrium migrate --dry-run`** — what _would_ change? Exit `0` unless the plan would be refused.
- **`sovrium migrate --check`** — is this database safe to upgrade? Exit `0` safe, `1` unsafe.

`--dry-run` and `--check` both write nothing, and cannot be combined: they ask different questions, and running them together would blur which answer you got.

## What it migrates

"Migration" names two independent systems, and this command owns both.

- **The shipped migrations** — the migration files bundled with the binary, covering authentication, system and internal tables, decided by the migration journal recorded in your database.
- **The config tables** — the `tables` in your configuration, covering your own tables, views and indexes, decided by a checksum of your table definitions. A lookup, rollup or count view is also rebuilt whenever the version you run would write it differently, so an upgrade reaches your lookups without a config change. On PostgreSQL that comparison creates a temporary view; a database role without the `TEMP` privilege cannot, so every start then runs the full migration and logs a warning saying so. On SQLite, a table whose stored CHECK rules (a single-select's options, a length or range limit) are not the ones its definition declares is rebuilt with its rows the same way, without a config change. An earlier version left the old rules in place when one edit both added or renamed a field and changed such a rule on the same table, so the first start after the upgrade repairs it.

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

The plan names the object that will really change. A table carrying a `lookup`, `rollup` or `count` field is stored as `<name>_base` behind a `<name>` view, so a new column is reported as `would alter table <name>_base (N statement(s))`. A computed field is never planned as a stored column, and an edit to another table plans nothing against `<name>_base`.

Every full migration rebuilds the view of **every** table with lookup, rollup or count fields, whichever table the change touched, so a `would rebuild view <name>` line appears for each of them whenever the tables in your config have changed since the last migration, or the version you run would write one of those views differently. Pending migrations alone do not rebuild them. It changes no rows. The line summarises the rebuild (`DROP VIEW IF EXISTS <name>`, then `CREATE VIEW <name>` over its computed fields) rather than printing the view's full definition.

Adding a table's first lookup, rollup or count field, or removing its last one, changes which object holds its rows. The migration does this by renaming the table, so the rows, the id sequence and the foreign keys pointing at it move with it, and nothing is copied or created empty. The plan says so: `would rename table <name> to <name>_base (rows kept)`, with the view rebuilt afterwards, or, in the other direction, `would rename table <name>_base to <name> (rows kept)`, whose statements first drop the view that holds the name.

A few changes rebuild a table and copy its rows across. The exact statements for those depend on the state of the table at the moment they run, so they cannot be rendered in advance. They are **named and labelled as unsimulated rather than left out** — a preview that quietly under-reports is worse than none, because you use it to decide whether the change needs a maintenance window.

After an upgrade to a version of Sovrium that computes formulas differently, the next migration recomputes each stored formula once, for the rows already in its table. The plan names every table it touches: `would recompute the formulas of table <name> (rows and their modification times kept)`, followed by the statements. No automation runs, and no row's modification time moves.

## Pre-flight with `--check`

Reports where the database stands — which engine, which migration folder, how much of the journal it has applied — then gives a verdict. On a database already at the current schema the verdict reads `No pending migrations. This database is at the current schema.`, also exit `0`.

Exit `1` means the upgrade would abort part-way through, or would not start, for one of four reasons:

- **Duplicate account identities** — two authentication rows a later migration's uniqueness constraint cannot both keep.
- **Duplicate OAuth client ids** — the same collision on the OAuth server's clients.
- **A rewritten released migration** — a migration file whose stored checksum no longer matches the file this build ships.
- **A table that would be dropped with its rows** — a table your config no longer declares, reported with its row count.

Each is reported with the offending rows named. Nothing is repaired automatically: deleting one of two colliding authentication rows would sever somebody's login, so the command names them and stops, and you decide which one survives.

**`--check` is a pre-flight, not a guarantee.** It reports the conditions it can prove would block the upgrade. A clean report means none of those were found — not that the migration will succeed.

## Destructive changes

When your config no longer declares a table that still holds rows, applying it would delete those rows. Sovrium does not do that on its own.

- `sovrium migrate --dry-run` prints the drop it would run, with the row count (`would drop table archived_campaigns (3 rows)` and its `DROP TABLE` statement), and exits `1`.
- `sovrium migrate --check` exits `1` and names the table and its rows.
- `sovrium migrate` and `sovrium start` refuse before writing anything, and name the command that would apply the drop.

Starting the app never drops a populated table. A removed table has no config entry left to carry a setting, and a setting on the whole app would keep consenting to every later edit. The consent is one-shot: read the plan, then run

```bash
sovrium migrate app.yaml --allow-destructive
```

It applies the drops the plan named, and nothing else. An empty table removed from the config is still dropped without asking. Tables the engine creates for you, meaning the `<name>_base` table behind a table with lookup, rollup or count fields and the junction table behind a many-to-many relationship, belong to your config and are never dropped as leftovers.

`--allow-destructive` is a different consent from a table's `allowDestructive: true`. The table setting lets a migration drop a **column** the config no longer declares on a table that is still there. The command-line flag lets one run drop a whole **table** the config no longer declares. Neither implies the other.

A table is renamed only when its `id` is written in the config: keep the `id` and change the `name`, and the migration renames the table in place, with its rows. That includes a table with lookup, rollup or count fields, whose `<name>_base` moves with it. Its many-to-many link tables move with it, links kept, whichever side of the link the renamed table is on — a table linked to itself included. Without a written `id`, a new name reads as one table removed and another added. If the old table still holds rows, the migration refuses, as it does for any populated table the config no longer declares, and the refusal names the `id` that keeps it (`declare it with id: 3`). Add that `id` to the renamed table instead of applying the drop with `--allow-destructive`, which would delete the rows. `--dry-run`, `--check` and the `--watch` reload read the rename the same way: the plan says `would rename table <old> to <new> (rows kept)`.

## In a deploy pipeline

```bash
sovrium migrate app.yaml && sovrium start app.yaml
```

Splitting them keeps schema work out of the web process, and gives a failed migration its own exit code instead of a boot that dies with no explanation. Pair it with `--check` in CI, ahead of the deploy, to learn about a blocked upgrade before you take traffic down.

## What it does not do

**It does not roll back.** Released migrations are forward-only and are never rewritten. Recovering from a bad upgrade means restoring a backup.

**It does not write any data.** Migrations shape the schema; rows come from `sovrium seed` or from the app itself. It also skips the best-effort work boot does after the schema is in place, so that a command named `migrate` has no side effects its name does not promise.

**It does not replace a correct boot.** `sovrium start` still migrates on its own. This command makes a broken upgrade recoverable and a deploy pipeline explicit; it is a route to the database, not a repair of the boot sequence.
