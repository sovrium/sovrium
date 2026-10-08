# Seeding Data

> Load relational sample data from files — natural keys for the links, relative dates that stay current, and three replay modes.

A freshly installed app has a schema and no rows. `sovrium seed` fills it from files you keep beside your config, so a new checkout opens on a working app instead of an empty grid.

```text
Usage: sovrium seed [config] [options]
```

It reads `seed/<table>.yaml`, resolves the links between records, expands any date tokens, and writes through the same code path the REST API uses. No server needs to be running.

Seeding is silent: it sends no table webhook and starts no record automation, so reloading demo data on every reset never reaches a receiver or an automation wired to production.

## The seed directory

One file per table, named after the table:

```text
my-app/
  app.yaml
  config/tables/companies.yaml
  config/tables/contacts.yaml
  seed/companies.yaml
  seed/contacts.yaml
```

```text
# seed/companies.yaml
records:
  - key: northwind
    fields:
      name: Northwind Trading
      industry: Retail
```

```text
# seed/contacts.yaml
records:
  - key: priya
    fields:
      name: Priya Raman
      email: priya@northwind.example
      company: '@companies.northwind'
      last_contacted: '{{today-3d}}'
```

Tables are written parents-first. You do not have to order the files yourself — the command reads your relationship fields and works out the order. A genuine cycle is refused by name rather than guessed at.

A relationship to the same table is not a dependency between tables: rows are inserted with that link empty, and the link is written once the row it names exists — so a row may name one defined later in the file, and an `upsert` replay writes the same link again rather than a new row.

```text
# seed/employees.yaml
records:
  - key: ahmed
    fields:
      name: Ahmed Benali
      manager: '@employees.ines'   # defined below
  - key: ines
    fields:
      name: Inès Moreau
```

## Linking records with `key`

`key` names a record inside your seed files. It is never written to a column and never appears in your database — it exists so one record can point at another before either has an id. Reference it from another file as `@<table>.<key>`; a many-to-many field takes a list of those references.

For a one-to-many relationship the foreign key lives on the child, so you seed the children pointing at the parent, not the parent listing its children.

## Dates that stay current

A fixed date ages. A pipeline whose deals all closed last spring reads as abandoned by autumn, and a calendar seeded with fixed days is empty the moment you look at a different month. Write dates relative to the day the seed runs — `{{today}}`, `{{today+21d}}`, `{{today-3d}}` — and every replay recomputes them, so a demo reset nightly always shows work in progress. A date can carry a time of day — `{{today+6d 14:00}}` is two in the afternoon six days out, in UTC — so an event seeded for the afternoon starts in the afternoon on every replay.

`--today <YYYY-MM-DD>` (or `SOVRIUM_SEED_TODAY`) sets the day every `{{today…}}` resolves against, so a seed reproduces the same dates on any day. The flag wins over the variable; a value that is not a real date is refused.

An empty or blank string for a date, datetime or time column seeds as no value.

## Modes

- **`if-empty`** — the default. Seeds a table only when it has no rows, so it is safe to run repeatedly. It counts soft-deleted rows as present, so a table you emptied through the app is not silently refilled underneath you.
- **`upsert`** — matches existing rows on a natural key and updates them; creates the rest. Rows it creates are recorded as written by the system, like every seeded row.
- **`replace`** — deletes the table's rows, then inserts. For demo environments that reset.

### Choosing what `upsert` matches on

`upsert` needs to know which column identifies an existing row. Declare it at the top of the seed file as `mergeOn: [email]`.

Without `mergeOn`, the command uses the table's single unique field. If the table has none, or more than one, it stops and asks — matching on the wrong column would overwrite unrelated records, so it will not guess.

`mergeOn` and `key` are different things: `key` links records inside your files, `mergeOn` names real columns in your database.

### Keeping a row's original creation date

A seed file may set one column the engine otherwise fills itself: `created_at`. Use it when importing rows from another system, so they keep the date they were really created instead of the date of the import.

```yaml
mergeOn: [code]
records:
  - key: printemps
    fields:
      code: recj8m0SAI0CM8Ha0
      created_at: '2023-03-14T12:00:00Z'
```

It is written when the row is inserted, in every mode. It is never changed afterwards: when `upsert` matches an existing row, a `created_at` in the file is ignored, because a row is created once. `updated_at`, `deleted_at` and the author columns stay the engine's own.

## Accounts and who wrote the rows

By default every row is written by the system, so a `created-by` column reads `system`. `--as <email>` writes the whole run as that account, so `created-by` and `updated-by` carry its id. The account must already exist, or be listed in `seed/users.yaml`; an unknown email is refused before anything is written.

`seed/users.yaml` lists sign-in accounts under a top-level `users:` key — `email`, `name`, `role`, and an optional `password`, else `SOVRIUM_SEED_PASSWORD`. They are created before any table, through the same path as `sovrium admin create`, so they can sign in; an email that already has an account is left unchanged, and an account with no password available, or with a role the app does not define, is refused before any account is created. The accounts are part of every run, including one restricted with `--table`.

```text
# seed/users.yaml
users:
  - email: ines@northwind.example
    name: Inès Moreau
    role: admin
  - email: ahmed@northwind.example
    name: Ahmed Benali
    role: member
```

The `users:` key is what tells this file apart from the seed file of a table named `users`, which uses `records:`.

A `user` field takes `'@user:<email>'`, resolved to that account's id. An email with no account is refused with the file, record, field and email.

### Pending invitations

An entry with `invited: true` is seeded as a pending invitation instead of an account that signs in: it takes no `password` (and needs no `SOVRIUM_SEED_PASSWORD`), gets no credential, and is listed among the team's waiting invitations. `invitedBy` names the account the invitation is from, so the invitation page can say who sent it; it must exist already or be listed in the same file without `invited`, and cannot be an account still waiting to accept its own invitation, since that account cannot sign in yet.

```yaml
# seed/users.yaml
users:
  - email: ines@northwind.example
    name: Inès Moreau
    role: admin
  - email: chloe@northwind.example
    name: Chloé Martin
    role: member
    invited: true
    invitedBy: ines@northwind.example
```

No email is sent. The run generates the invitation's token and prints its link once — the link an invitation email would carry, on the page the app declares for invitations. A seed run answers no request, so the link starts with `BASE_URL` when it is set and is the page's path alone otherwise:

```text
accounts: created 1, invited 1, 0 already present
invitation: chloe@northwind.example → /join?token=…
```

The token is never read from a file, so a seed folder published with a template holds nothing anyone could accept. A replay leaves an existing invitation and its link as they are; an invitation that has lapsed is renewed with **Resend** in the console. `--dry-run` counts the invitations it would create and prints no link.

## Options

- **`[config]`** — the config file. Auto-discovered when omitted: `app.yaml`, then `app.yml`, then `app.ts`, inside the project directory.
- **`--dir <path>`** — the seed directory. Defaults to a `seed` folder beside the **config file** rather than beside your shell, so the same command behaves identically from the project root or from a service unit with a different working directory. An explicit path is resolved against the working directory.
- **`--mode <mode>`** — `if-empty`, `upsert` or `replace`. Defaults to `if-empty`.
- **`--table <name>`** — seed only this table. Repeat for several.
- **`--dry-run`** — report what would be written and write nothing. Under `upsert` it reports `would write N records (mode: upsert)`, because whether each row is created or updated is only known when it runs.
- **`--as <email>`** — write every row as this account instead of the system.
- **`--today <date>`** — the day `{{today…}}` resolves against, as `YYYY-MM-DD`. Overrides `SOVRIUM_SEED_TODAY`.

## Attachments

Put files in `seed/assets/` and reference them by name as `'@asset:northwind-logo.avif'`. The file is uploaded and the stored key is written to the field. A `multiple-attachments` field takes a list of them — one `'@asset:…'` per file — and stores every file, in the order listed.

An `@asset:` file is uploaded into the bucket its field declares; a `public: true` bucket serves it without a session.

## What seeding does not do

**It does not run your automations.** Records are written directly, so an automation that reacts to record creation will not have fired. If your app's demo value depends on something an automation produces — an activity log, a derived status — seed that too, written the way the automation would have written it.

**Some fields are refused rather than half-written**, each with a message naming the file and record: `upsert` on a table whose seed data carries many-to-many links. Refusing is deliberate — writing the row and dropping the links would leave you with data that looks complete and is not.

## When a record is rejected

The message names the file, the record, the field, the value and the reason:

```text
companies.yaml (key "northwind"): field "size" — 201 is not one of the declared
options ('1-10', '11-50', '51-200', '201-1000', '1000+') — the submitted value is a
number; quote it in YAML to keep it a string [CHECK constraint failed: check_size_enum]
```

**Quote select values that start with a digit.** That is the most common surprise. YAML reads a scalar beginning with a digit as a number, and a trailing range or suffix does not stop it: `201-1000` becomes `201`, `1000+` becomes `1000`, `07` becomes `7`, `1e3` becomes `1000`, and `2.0` becomes `2`. Quote them and the value survives. `yes`, `no`, `on` and `off` are read as strings and need no quoting.

## Working on the data

```bash
sovrium seed --dry-run                       # the plan, nothing written
sovrium seed --table contacts --mode replace # iterate on one file
```
