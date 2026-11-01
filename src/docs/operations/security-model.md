# Security Model

> Who can reach your data and through which door: the database stays private, every read and write passes the engine checks, and an owner-only row rule is one line of config.

Sovrium never hands your database to a browser. The only connection string is yours, the operator's; every person, script and AI that touches a record goes through the engine, and the engine checks the same rules on every door. This article states that model in full (who can reach what, what a read and a write check, and what Sovrium deliberately does not do) so you can judge it against your own threat model rather than take it on trust.

The headers, CSRF, rate limits and secrets that harden each response are a separate subject: **Security Hardening**.

## Who can reach what

| Who                                                        | What they hold                                                                          | What they reach                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A visitor who is not signed in                             | Nothing                                                                                 | The pages, forms and records your config opens to `all`, and no row a rule naming the signed-in person scopes |
| A signed-in person                                         | A session cookie                                                                        | What her role, her groups and her assignments grant, narrowed by each table's row and field rules             |
| A script or service                                        | An API key, valid one year unless minted for less                                       | What the person who minted the key may reach, resolved again on every request, except account management      |
| An AI client                                               | An API key, or an OAuth access token a person authorised, presented to the MCP endpoint | The same as that person; an MCP tool is one more door, not a wider one                                        |
| A person holding the `admin` role (or the top custom role) | A session                                                                               | Every row of every table, past row-level rules, and the read-only operator console at `/_admin`               |
| The operator                                               | `DATABASE_URL` or the data directory, the encryption key, the server and its backups    | Everything, directly. This is the one principal no rule constrains                                            |

An API key never reaches account management (`/api/auth/admin/*`), a change to the organisation or its groups, notification preferences or account deletion: those answer a key `404` and need the person signed in. The browser never receives a database credential, a service key or a query language. What it receives is HTML and JSON the engine has already filtered for the person asking.

## Your database is never exposed to a client

With the default SQLite, the database is a file in the data directory; with PostgreSQL, it is the server `DATABASE_URL` names. In both cases Sovrium is the only program that connects, and it does so with the operator's credential. No route accepts SQL, no route forwards a query to the database as written, and no configuration is changed over HTTP: you change the app by editing its config file and redeploying.

A request therefore reaches data only through an endpoint the engine implements (the records API, a page, a hosted form, a real-time subscription, the MCP tools, the AI chat), and each of those builds its query itself, binding every value as a parameter. A client can ask for a filter, a sort or a page; it cannot ask for a table, a column or a row the rules keep from it.

## The four checks of a read

Every read of a table, on every door, runs one composed plan of four checks:

1. **The table's role gate.** `permissions.read` must admit the caller, counting her role, the groups she belongs to and the roles her assignments give her. A table that does not admit her answers exactly as a table that does not exist.
2. **The row rule, turned into a filter.** `rowLevelPermissions.read.when` becomes part of the query itself, so a row the rule excludes is never fetched. It is not a page filter applied afterwards.
3. **The trash filter.** Soft-deleted rows stay out unless the trash is asked for, and asking for it is itself a permission.
4. **The field allow-list.** Only the fields the caller may read are returned, filtered on, grouped by or aggregated. A hidden field cannot leak through a filter or a count.

A row outside the plan answers **`404`**, with the same body as a row that does not exist. Answering `403` would confirm that the row is there; the `404` does not.

## What a write checks

A create, an update or a delete runs the same gate for its own operation, then:

- **Create**: the new row must satisfy `rowLevelPermissions.create.when`, judged on the row as it will be stored, defaults included. A row outside the rule answers `404`, as an out-of-scope read does, and nothing is written.
- **Update**: the row must pass the `read` rule and the `write` rule as it stands, and the `write` rule again as the change would leave it. Someone who may edit a record cannot hand it to a scope that is not theirs.
- **Delete and restore**: the row must pass the `read` rule and the `delete` rule; a restore is judged on the row in the trash.
- **Every write**: a field the caller may not write is refused, a value that breaks a field's rules is refused, rich text is cleaned, and authorship fields are stamped by the engine rather than taken from the request.
- **Business rules**: a table's `rules` are judged inside the write, on the record as it stands when the write lands, so of two changes sent to one record at once the second is judged on what the first left. An update whose record another path changed in between is refused with `409`, and nothing is written. The same holds for the records an upsert matches, judged as updates, and for a restore from the trash, judged as an update that changes no field; a batch restore or an upsert that one rule refuses writes no row at all.

A refused write answers as a missing row and changes nothing. A table that requires a session answers a visitor who is not signed in `401`, which says that signing in is needed and nothing about any record.

## The same rule on every door

A rule written once applies wherever the data can be reached:

- the records API, its batch routes, its exports and its figures (what a KPI or a chart draws from);
- server-rendered pages, their lists, boards, calendars and record pages;
- hosted forms, including the choices a relationship field offers;
- real-time subscriptions, which push only the rows the subscriber may read;
- search and the command palette;
- the MCP tools an AI client calls;
- the AI chat, which answers within the asking person's rights;
- an automation a person starts by hand, which writes as that person.

An automation nobody started (a schedule, a webhook, a record event, a form submission) acts for the app rather than for a person, so it is not narrowed by any reader's rules. You write those workflows in your config, and they do what the config says.

## One instance, one app, one database

A Sovrium instance serves one app, as one organisation, from one database. There is no tenancy inside an instance and no shared database between instances: to keep two customers' data apart, run one instance and one database for each. Inside one app, row rules and assignments decide which person reaches which rows. The client portal where each customer sees only their own tickets is the common case.

## An app without sign-in

An app with no `auth` block has no accounts, so every visitor is the same anonymous caller, and the rule is short: she holds exactly the operations a table declares with `all`, one operation at a time. A table that declares no `permissions`, or names `authenticated` or a list of roles for an operation, answers her that operation as a table that does not exist (`404`, the same body), on every door listed above and on a static export. Field `read` rules do not narrow what she sees of a table she may read; a write-only field is still never returned. Rebuilding the knowledge index answers `404` there, since nobody can be an administrator.

The operator console mounted into an app is the exception: it shows the host app's tables under the host app's sign-in, whatever its own config declares.

## Owner-only rows

The rule people ask for first is "a person sees only the rows they created". Declare a `created-by` field, which Sovrium stamps on every create and never takes from the request, and compare it with the signed-in person:

```yaml
tables:
  - name: journal_entries
    fields:
      - { id: 1, name: title, type: single-line-text, required: true }
      - { id: 2, name: created_by, type: created-by }
    permissions:
      read: authenticated
      create: authenticated
      update: authenticated
      delete: authenticated
    rowLevelPermissions:
      read: { when: { field: created_by, operator: eq, value: $currentUser.id } }
      write: { when: { field: created_by, operator: eq, value: $currentUser.id } }
      delete: { when: { field: created_by, operator: eq, value: $currentUser.id } }
```

The same intent written as a database-level row policy, as many PostgreSQL-backed stacks express it, looks like this. `current_user_id()` stands for whatever function the stack provides to read the caller's identity from the connection:

```sql
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_only ON journal_entries
  USING (created_by = current_user_id())
  WITH CHECK (created_by = current_user_id());
```

The two state the same rule. They differ in where it is enforced, and that difference is the whole security model.

## Database policies and this model

A database-level row policy earns its place when **clients connect to the database directly**: a public key in the browser, a query endpoint that forwards requests as written, an analyst with a connection string. The policy is then the only thing standing between those clients and every row, so it has to live in the database.

In Sovrium, no client connects to the database, so that reason does not arise: the engine is the only client, and it applies the rule before the query is built. The other things database policies offer are worth stating plainly, with what Sovrium does about each:

- **Defence in depth.** A second lock at the database level still holds if the application layer has a bug. Sovrium has one enforcement layer for rows, the engine, and relies on a single composed read plan, shared by every door, so that one fix covers every surface.
- **A rule a database tool can read.** A policy is visible to anyone who inspects the schema. A Sovrium rule lives in your config file, under version control, and `sovrium validate` refuses a rule it cannot evaluate before the app starts.
- **Rules that follow every connection.** A database policy also restricts a reporting tool or a script that connects directly. **Sovrium writes no policies into the database, and creates no database role per person.** Anyone who connects with the operator's credential, or opens the SQLite file, or restores a backup, reads every row of every table, whatever the config says.

What follows for you as the operator:

- Keep the database private. Do not publish the PostgreSQL port, do not share `DATABASE_URL`, and on a shared PostgreSQL server give Sovrium its own database and its own role.
- Treat the data directory and every backup archive as a master credential: they hold every row and, by default, the encryption key.
- Give a reporting tool or a script an API key minted by a person whose rights fit the job, and read through the records API. It then receives exactly what that person may read, under the same rules.
- Remember that a person holding the `admin` role reads past row rules. Grant it to operators, not to the people a rule is meant to separate.

## Limits

- Row rules compare a field with a value: `eq`, `neq`, `in` and `contains`, combined with `and` and `or`, on the table's own columns or one many-to-one relationship away. A rule that needs arbitrary logic is not expressible.
- Record ids count up, so they are guessable. The `404` hides whether a row exists and what it holds; it does not make an id secret.
- When sign-up is open (`auth.allowSignUp: true`), a sign-up answer can reveal whether an address already has an account: registering a known address is refused, a new one is not. The default, closed sign-up gives nobody that answer, and the password-reset, sign-in link and sign-in code requests answer a known and an unknown address alike, in the same time: the mail goes out after the answer.
- Automations nobody started, outgoing webhooks and scheduled jobs act for the app and read whatever their configuration names.
- The operator console is read-only and admin-only, but an admin sees every row it shows.

## Related reading

- **Table Permissions**: the role, field and row rules, with every operator and the owner-only recipe.
- **Roles & RBAC**: the built-in roles and how custom roles rank.
- **Assignments & Landing Guards**: scoping a person to the records they are assigned.
- **API Keys**: a credential that carries its owner's rights.
- **Security Hardening**: response headers, CSRF, rate limits, secrets and backups.
- **GDPR & Privacy**: data export and hard-deleting erasure.
- **Database Infrastructure**: SQLite, PostgreSQL and the data directory.
