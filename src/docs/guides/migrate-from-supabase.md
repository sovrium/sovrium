# Migrate from Supabase to Sovrium

> Move a Supabase project to a self-hosted Sovrium app with `sovrium import`: its tables and rows, its row-level security, its users and its storage buckets, then point your own front-end at the new app with a generated typed client.

Your app keeps its data in a Supabase project: tables in the `public` schema protected by row-level security, users signed in through Supabase Auth, files in storage buckets, and a front-end that calls all of it from the browser. `sovrium import` reads the project once, read-only, and turns those four parts into a Sovrium config and seed files. `sovrium client` then writes the file your front-end calls the new app with.

## Before you start

You need an app to import into. An empty one with email and password sign-in is enough, so your users can become accounts:

```yaml
name: notes
version: 1.0.0
auth:
  strategies:
    - type: emailAndPassword
```

From the Supabase dashboard, copy three values into your shell. A Supabase project's `.env` usually holds the last two already, under the same names:

- `SUPABASE_DB_URL`: the database connection string from the project's **Connect** panel, password included.
- `SUPABASE_URL`: the project URL, `https://<ref>.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: the service-role key from the project's API settings. The import uses it only to download your files.

All three stay in your environment. None of them is written to the snapshot, the config, a seed file, the report or the terminal.

## 1. Fetch a snapshot

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<pooler host>:5432/postgres'
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=…
sovrium import fetch 'supabase:$env.SUPABASE_DB_URL'
```

Keep the single quotes: the URI names the variable, and the snapshot records that name, never the URL. A URI holding the URL itself is refused.

The fetch opens one connection inside one read-only transaction, which is rolled back at the end, so nothing it sends can write. It reads:

- the tables, columns and keys of the `public` schema, and every row;
- whether each table has row-level security switched on, and its policies;
- the users from `auth.users`, but never their password hashes;
- the buckets and the list of objects they hold, and the names of the storage policies.

The files themselves are then downloaded through the Storage API, with `GET` requests only. `SUPABASE_URL` must be `https` (plain `http` is accepted for a local project on the loopback host), and a URL holding a user name, a password, a path or a query is refused.

The snapshot lands in a `.sovrium-imports/supabase-…` folder you keep. To bring the buckets without their files, add `--skip-attachments`: the bucket definitions are still read, each file is counted as skipped, and the two storage variables are not needed.

## 2. Preview the migration

```bash
sovrium import .sovrium-imports/supabase-… --config app.yaml
```

A dry run is the default: it prints the report and writes nothing. The conversion reads the snapshot offline, and the same snapshot always gives the same result, so preview as often as you like.

## 3. Read the report

An abridged report for a project with two tables, a few dozen users and one bucket:

```text
Tables (2):
  + notes (5 fields, from notes)
  + projects (4 fields, from projects)

Records (2 seed files):
  seed/import/notes.yaml: 120 records, keyed by source id
  seed/import/projects.yaml: 8 records, keyed by source id

Access rules (2 tables, from row-level security):
  notes: read authenticated (own rows, owner_id), create authenticated (own rows, owner_id), update authenticated (own rows, owner_id), delete admin only
    not translated: "Team leads can delete" (DELETE) — The expression is outside the translation table, so what it governs is closed to admin. …
  projects: read admin only, create admin only, update admin only, delete admin only — row-level security was off: closed

Accounts (42 accounts, 3 pending invitations):
  No password was carried over: the source's password hashes cannot be verified here, so each of the 42 accounts sets a password by resetting it, and each invited person by accepting the invitation.
  left out: 5 anonymous users

Buckets (1):
  + avatars (public, from avatars): 37 files
  storage policy not translated: Avatar images are publicly accessible
```

The sections below explain each part.

### Tables and rows

Each table of the `public` schema becomes a Sovrium table, with its rows as seed records. Supabase's own schemas (`auth`, `storage`, `realtime` and the others) are never imported as tables.

- A column is typed from its PostgreSQL type; a type with no match is kept as text, and the report says so.
- An enum column becomes a single select whose options are the enum's labels.
- A column that references `auth.users` becomes a `user` field. Each row names its account by email, so it keeps the same owner even though the account id changes.
- Any other one-column foreign key becomes a relationship to the table it references.

The full type mapping is in [Migrating From Baserow, Retool Database, Supabase, Webflow CMS and Zite](/en/docs/cli-import-databases).

### Row-level security

Each policy is translated into the table's `permissions` and `rowLevelPermissions` through a closed table. `SELECT`, `INSERT`, `UPDATE` and `DELETE` become `read`, `create`, `update` and `delete`.

| Policy in Supabase                                                                   | In Sovrium                                                             |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `true`, for `anon` or `public`                                                       | the operation open to `all`                                            |
| `true` for `authenticated`, or `auth.role() = 'authenticated'`                       | the operation open to `authenticated`                                  |
| `auth.uid() = owner_id`, `owner_id = auth.uid()` or `(select auth.uid()) = owner_id` | `authenticated`, with a row rule `owner_id` equal to `$currentUser.id` |
| several such policies on one operation, under the same role                          | their row rules joined with `or`                                       |
| anything else                                                                        | not translated: the operation is closed to `admin`                     |

"Anything else" covers another function, a sub-select or a join, a comparison with a literal, a restrictive policy, an owner column that does not reference `auth.users`, a custom role, and policies under different roles on the same operation. Each one is quoted in the report with its table, its name, its command and its expression as Supabase stores it.

Two cases are closed on purpose:

- **An operation no policy covers** is closed to `admin`, as it was in Supabase.
- **A table with row-level security switched off** is imported with every operation closed to `admin`, and the report says so.

Nothing is opened by omission. To open an operation, edit its `permissions` in the config. To let people reach only the rows they own, use the owner-only recipe in [Table Permissions](/en/docs/table-permissions).

### Users

Each user with an email becomes an account with the `member` role, named from the user's metadata or, failing that, the part of the email before the `@`.

- A user who confirmed their email becomes an account with no password and no invitation. Nothing is sent to them.
- A user you invited who never accepted becomes a pending invitation. `sovrium seed` prints its link.
- Anonymous users, users with no email (phone sign-in only) and deleted users are left out, and counted by reason.

**No password comes across.** Supabase's password hashes cannot be verified by Sovrium, so each person sets a new password by resetting it, or by accepting their invitation. Plan to tell your users before the switch.

### Buckets and files

Each bucket becomes a `buckets:` entry. Its name is made a Sovrium bucket name (lower case, letters, digits and hyphens), and it keeps its visibility, its size limit as `maxFileSize` and its accepted types as `allowedMimeTypes`. Each file is written under `seed/import/buckets/<bucket>/`, at the same path it had in Supabase.

Storage policies are listed by name in the report, not translated: each bucket arrives with Sovrium's defaults for its visibility. See [Buckets](/en/docs/buckets) to set who may upload and read.

## 4. Write and seed

```bash
sovrium import .sovrium-imports/supabase-… --config app.yaml --write --apply
sovrium start app.yaml
```

`--write` adds the tables, their access rules and the buckets to `app.yaml` and writes the rows, the accounts and the files to `seed/import/`, which holds your real data and is added to `.gitignore`. `--apply` then seeds them and stores each file in the app's own bucket store. Running the same command again changes nothing.

To import one part on its own, use `--only`:

```bash
sovrium import .sovrium-imports/supabase-… --config app.yaml --only auth --write
sovrium import .sovrium-imports/supabase-… --config app.yaml --only buckets --write
```

Access rules have no part of their own: they always come with their tables, so a table is never written without them.

Open `/_admin/records` to check the tables and their records, and sign in as a test account to check what a member reaches.

## 5. Point your front-end at the app

Generate a typed client for the app's records API in your front-end project:

```bash
sovrium client app.yaml --output src/lib/sovrium-client.ts
```

The file needs no package and is typed from your own tables, fields and views. Replace the calls your front-end made to Supabase with calls to it:

```ts
import { createClient } from './lib/sovrium-client'

const sovrium = createClient({ url: 'https://notes.example.com' })

await sovrium.auth.signIn({ email, password })

const { data, error } = await sovrium.from('notes').list({ sort: 'created_at:desc', limit: 20 })
```

Every call answers `{ data, error }` and never throws on a refused request. A record the signed-in person may not read answers `404`, exactly like one that does not exist. Run `sovrium client --check` in CI to catch a client that fell behind the config. The calls, the types and what the client does not cover yet are in [Call the API from Your Own Front-End](/en/docs/cli-client).

**In the browser, the client signs in with a session cookie.** There is no public project key to ship: `createClient` refuses an API key wherever `window` exists, before any request is sent. Keep API keys for scripts and server code.

## 6. Allow your front-end's origin

When your front-end is served from another origin than the app (a site on its own domain, a dev server on `http://localhost:5173`), name that origin on the Sovrium server:

```bash
SOVRIUM_CORS_ORIGINS=https://notes.example.com,http://localhost:5173
```

The browser then lets your front-end sign people in and read and write records as them. Origins are exact: a wildcard, `*` or a path stops the start with a line naming the entry. The variable is read once at start. See [Environment Variables: Hosting Under a Supervisor](/en/docs/env-vars-hosting) for its full rules and [Security Hardening](/en/docs/security-hardening) for the checks it changes.

## 7. Switch over

1. Tell your users that they will set a new password, and when.
2. Stop writes to the Supabase project.
3. Fetch a fresh snapshot (each fetch writes a new folder) and import it with `--write --apply`: rows merge on their source id, so new rows are added and changed ones updated.
4. Deploy the app, set `SOVRIUM_CORS_ORIGINS` if your front-end needs it, and deploy the front-end with its new client.

Every person, script and AI that reaches your data now goes through the same engine checks. [Security Model](/en/docs/security-model) states who can reach what, and why a refused read answers `404`.

## What does not come across

- **Storage policies**: listed by name, not translated. Set each bucket's access in the config.
- **Policies outside the translation table**: quoted in the report and closed to `admin`. Rewrite each as `permissions` and a row rule.
- **Password hashes**: never read. Each person sets a new password.
- **Social sign-ins**: not carried. A person who signed in with a provider signs in once with the same provider configured in Sovrium, or resets a password.
- **Anonymous, phone-only and deleted users**: left out and counted.
- **Database functions, triggers and views**: not read. Rebuild the logic as formula fields, rollups or automations on the imported tables.
- **Edge functions**: code outside the database, not read. Rebuild each as an automation, often with a webhook trigger.
- **Realtime channels and Supabase's other schemas**: not imported as tables.
