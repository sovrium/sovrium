# Seeding Data

> Load relational sample data from files — natural keys for the links, relative dates that stay current, and three replay modes.

A freshly installed app has a schema and no rows. `sovrium seed` fills it from files you keep beside your config, so a new checkout opens on a working app instead of an empty grid.

```text
Usage: sovrium seed [config] [options]
```

It reads `seed/<table>.yaml`, resolves the links between records, expands any date tokens, and writes through the same code path the REST API uses. No server needs to be running.

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

## Linking records with `key`

`key` names a record inside your seed files. It is never written to a column and never appears in your database — it exists so one record can point at another before either has an id. Reference it from another file as `@<table>.<key>`; a many-to-many field takes a list of those references.

For a one-to-many relationship the foreign key lives on the child, so you seed the children pointing at the parent, not the parent listing its children.

## Dates that stay current

A fixed date ages. A pipeline whose deals all closed last spring reads as abandoned by autumn, and a calendar seeded with fixed days is empty the moment you look at a different month. Write dates relative to the day the seed runs — `{{today}}`, `{{today+21d}}`, `{{today-3d}}` — and every replay recomputes them, so a demo reset nightly always shows work in progress.

## Modes

- **`if-empty`** — the default. Seeds a table only when it has no rows, so it is safe to run repeatedly. It counts soft-deleted rows as present, so a table you emptied through the app is not silently refilled underneath you.
- **`upsert`** — matches existing rows on a natural key and updates them; creates the rest.
- **`replace`** — deletes the table's rows, then inserts. For demo environments that reset.

### Choosing what `upsert` matches on

`upsert` needs to know which column identifies an existing row. Declare it at the top of the seed file as `mergeOn: [email]`.

Without `mergeOn`, the command uses the table's single unique field. If the table has none, or more than one, it stops and asks — matching on the wrong column would overwrite unrelated records, so it will not guess.

`mergeOn` and `key` are different things: `key` links records inside your files, `mergeOn` names real columns in your database.

## Options

- **`[config]`** — the config file. Auto-discovered when omitted: `app.yaml`, then `app.yml`, then `app.ts`, inside the project directory.
- **`--dir <path>`** — the seed directory. Defaults to a `seed` folder beside the **config file** rather than beside your shell, so the same command behaves identically from the project root or from a service unit with a different working directory. An explicit path is resolved against the working directory.
- **`--mode <mode>`** — `if-empty`, `upsert` or `replace`. Defaults to `if-empty`.
- **`--table <name>`** — seed only this table. Repeat for several.
- **`--dry-run`** — report what would be written and write nothing.

## Attachments

Put files in `seed/assets/` and reference them by name as `'@asset:northwind-logo.avif'`. The file is uploaded and the stored key is written to the field.

## What seeding does not do

**It does not run your automations.** Records are written directly, so an automation that reacts to record creation will not have fired. If your app's demo value depends on something an automation produces — an activity log, a derived status — seed that too, written the way the automation would have written it.

**Some fields are refused rather than half-written**, each with a message naming the file and record: a relationship pointing at its own table (it needs two passes, and is not supported yet), an attachment field on a bucket other than the default, and `upsert` on a table whose seed data carries many-to-many links. Refusing is deliberate — writing the row and dropping the links would leave you with data that looks complete and is not.

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
