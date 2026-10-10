# Upgrade and roll back a Sovrium app

> Move a Sovrium app to a new version safely — back up first, let the boot-time migration run, and roll back by restoring the backup with the prior binary.

Schema migrations are **forward-only**: a released migration is never rewritten, and there is no automatic downgrade. So a safe upgrade always pairs with a backup you can restore.

## Upgrade

Back up first with `sovrium backup` — one archive holding the database, the encryption key, the config and the uploads, taken while the app keeps serving — then move to the new version and restart. The schema migration runs on boot, inside a transaction, before the app serves traffic:

```bash
sovrium backup app.yaml --output /backups/pre-upgrade.tar.gz
sovrium update            # binary install; or: docker pull ghcr.io/sovrium/sovrium:latest
sovrium stop && sovrium start app.yaml
```

If the migration fails, the transaction rolls back and the server refuses to start on an inconsistent schema — you are never left half-migrated.

Visitors' browsers pick up the new version on their own. Pages load the client scripts under names derived from their content, so the first page served after the restart asks for the new scripts and nothing cached from the old version can stand in for them. The old, unhashed names still answer for one release, served so that a browser checks them again on every use. A page that was already open before the upgrade and asks for a part of the old version that no longer exists reloads itself once, then runs the new version. Nobody needs a hard refresh, and there is no cache to purge.

## Check the config with the new version first

A new version can refuse a config the old one accepted: each release closes mistakes that used to validate and then failed later, or quietly did the wrong thing. Run `sovrium validate` **with the new version, before you stop the old server** — between `sovrium update` and the restart above — so a refusal costs you nothing but an edit:

```bash
sovrium update
sovrium validate app.yaml   # the new version's verdict; the old server is still serving
sovrium stop && sovrium start app.yaml
```

A refusal names the place in the config and, in most cases, what to write instead. Fix it, validate again, then restart. Environment variables are read when the server starts rather than by `validate`, so an invalid one surfaces at `start`, before the app serves traffic. Then read the breaking changes between your version and the new one — `sovrium changelog --since <the version you run>` gathers them in one list.

## Upgrading from 0.34 to 0.35

Run `sovrium validate` with 0.35 before you restart, then read the behaviours below that your app relies on.

### Behaviour that changes without a config change

- **An `http/*` request the outbound guard refuses fails once, and is no longer retried.** A request to a private address, with a scheme other than `http` or `https`, with a malformed `url`, or whose `https` connection cannot be secured now fails the step with `error.code` set to `blocked` or `tls`, and a retry policy no longer tries it again. A step that relied on its retries for such a URL now fails on the first attempt: fix the URL, or the certificate on the other side. See [HTTP & Webhook Actions](/en/docs/automation-http-actions).
- **An empty template value written to a number or a link column is stored as NULL.** A record step writing an empty value to a number, currency, percentage, progress, rating, duration, relationship or user column used to store `0`, or fail on the foreign key; it now stores NULL. A text column keeps the empty string. Review any filter or formula that counted on the `0`. See [Record Actions](/en/docs/automation-record-actions).
- **JSON text written to a `json` column is stored as the object or array it spells.** A record step writing the text of a JSON object or array to a `json` column now stores the parsed value, as the records API does. Text spelling a scalar (`"42"`, `"true"`) is still stored as text, and rows written before the upgrade are left as they are.
- **A record trigger no longer hands an automation the fields only admins may read.** The row, the previous row and the related rows a record trigger expands now leave out every field whose read permission is admin-only. An automation that read such a field from `{{trigger.data.…}}` now reads nothing there: read the row through a `record/read` step instead.
- **A `relative-time` column reads in the largest whole unit.** A cell reads `now`, a number of minutes or hours, `yesterday`, or a number of days, where it used to count whole days only. See [Data Components](/en/docs/data-components).
- **`toolbar.export: false` also removes Export selected.** A table grid that turns its export off no longer offers to export the rows a reader ticks. A grid that leaves `export` undeclared keeps the selection export.
- **A bulk action's confirmation buttons are translated.** The two buttons read in the page's language through the string catalogue (`Confirmer` and `Annuler` on a French page), where they always read in English. Name them yourself with `confirm: { message, confirmLabel, cancelLabel }`.
- **A chart over hours or minutes labels its ticks as times of day.** With `xAxis.format: date`, a chart bucketing by `hour` or `minute` writes each tick as its time of day in the operator timezone, and adds the day and month when the chart spans several days. See [Charts](/en/docs/data-components-charts).
- **Telemetry ingest no longer counts against `API_IP_RATE_LIMIT`.** The paths a telemetry webhook trigger serves are refused by their own per-project and per-address budgets instead, so a busy reporter no longer spends the ceiling your other API clients share. See [Telemetry Triggers](/en/docs/trigger-webhook-telemetry).
- **Run history can be shortened.** `SOVRIUM_AUTOMATION_RUN_RETENTION_DAYS` deletes the runs that ended more than that many days ago, once a day; unset, every run is kept, as before. A trigger's `history: 'minimal'` keeps each run it starts without its trigger data or its steps, and replaying such a run without new trigger data answers `409`. See [Automation Runs](/en/docs/automation-runs).
- **An invalid `BROWSER_*` value stops the start, even while the browser is off.** If your environment already sets a variable whose name starts with `BROWSER_`, check it against the accepted values before you restart; the refusal names the variable and what it accepts. The checks between the browser's and the document renderer's Chrome settings apply only once the browser is on. See [Environment Variables: Browser Automation](/en/docs/env-vars-browser).
- **The migration adds one table, for browser sessions.** The boot-time migration creates `browser_sessions`, which holds the signed-in sessions a browser step saves, encrypted with the instance key. It stays empty until a step saves one, it is included in `sovrium backup`, and a rollback that restores the pre-upgrade backup removes it.
- **A public form placed on a page with `formRef` now renders for signed-out visitors.** A form that declares no `access`, bound to a table whose `create` grant does not admit visitors, rendered an empty container on the page while `/forms/<name>` served it and accepted the submission. The page now draws it as its own page does, and a submission from it is stamped with `system`. Give the form an `access` block if it was not meant to be public.
- **A `visibility.record` gate on a checkbox compares yes or no.** `eq: true` now keeps a component on the ticked records and `eq: false` on the others, on SQLite as on PostgreSQL; on SQLite both used to match no record, and `neq: true` every record. See [Component Modules](/en/docs/component-modules).
- **A number or a word compared with a checkbox reads as yes or no, on either database.** In a `dataSource.filter`, a `visibility.record` gate, a collection page's `collection.filter`, a form's choice-list `filter`, a table view's `filters`, the `filters` of a lookup, rollup or count, and a records API `?filter` written as JSON, `1` and `"true"` now mean ticked and `0` and `"false"` unticked. On SQLite a collection page filtered with `value: true` on a checkbox used to answer 404 for every record; it now shows the ticked ones. On PostgreSQL a filter written with `value: 1` or `value: 0` on a checkbox used to fail the page with a server error, and a gate written with `eq: 1` matched no record; both now behave as on SQLite. A table view, lookup, rollup or count filtered that way on PostgreSQL used to stop the app from starting, and a JSON `?filter` used to answer a server error; on SQLite, the same filters written with `"true"` or `"f"` used to match no record. Prefer `true` and `false`. See [Data Components](/en/docs/data-components).
- **A multi-select prints its labels in a description-list field entry and in a list row.** A `description-list` entry naming a multi-select with `field` draws one chip per label on SQLite too, where it printed the stored text (`["red","blue"]`), and a `record-field` inside the row of a bound `list` prints the labels — and any other value formatted by its type, a date included — exactly as the same `record-field` prints them on a record page. See [Display Components](/en/docs/display-components).
- **The audit log loads on SQLite once an entry carries details.** On SQLite, `GET /api/admin/audit-log` and the admin audit log tool of the MCP server failed with "Failed to build audit-log response" as soon as the trail held an entry with details — a role change is the first one most instances record. Both now answer, and each entry's `metadata` reads as the same object it reads on PostgreSQL. Nothing was lost: the entries were stored intact and read back in full.
- **A structural `timeline` draws its markers.** A `timeline` with `children` and no `dataSource` now draws a marker on the rail beside each child, as documented. A page that drew its own dots inside the children shows both: remove the hand-drawn ones.
- **A `fetch` body value that is exactly `$record.<field>` over a list sends the list.** On a multi-select, a field holding several attachments or any other list column, such a value used to reach the server as the items joined into one text (`"a,b"`); it now arrives as a JSON array (`["a", "b"]`). This applies to every `fetch` action's `body`, and to the `inputData` an `automation` action sends from a table row. An endpoint that parsed the joined text must now accept an array. A reference inside a longer string (`'tags: $record.tags'`) is unchanged and still writes the joined text. See [Interactions](/en/docs/interactions).
- **The migration adds four columns to `auth.device_code`.** The boot-time migration adds `redirect_uri`, `device_name`, `return_code_hash` and `requested_at`, all nullable, which hold a one-click sign-in while it waits for approval. A rollback that restores the pre-upgrade backup removes the columns.
- **`sovrium login` signs in with one click by default.** It opens the approval page in your browser, and the browser hands the answer back to the CLI through a listener on `127.0.0.1`, where it used to print a code to approve. Pass `--device` to keep the code; the CLI keeps it by itself over SSH, in CI and on a machine without a browser. See [Sign In to a Sovrium Cloud](/en/docs/login).
- **`sovrium seed --dry-run` in `if-empty` mode reports the tables it would skip.** It now counts the rows of each table, and a table that already holds some reads `would skip (N rows already present)`, the skip the real run makes, where it used to read `would create N records` for every table. A script that parsed the dry run's lines should expect the new one. See [Seeding Data](/en/docs/cli-seed).

### New in 0.35

These options are additive: a config that does not use them behaves as before.

- `tables[].retention` deletes a table's oldest rows once a day, and `tables[].activityLog: false` stops writing activity entries for its records. See [Table Retention](/en/docs/table-retention).
- A webhook trigger's `protocol` serves a telemetry protocol, authenticated with `auth.type: projectKey` and capped with `rateLimit.per`. See [Telemetry Triggers](/en/docs/trigger-webhook-telemetry).
- `fullTextSearch` on a `long-text` field, with `searchEngine: 'fts'`, makes the field searchable by word. See [Full-Text Search](/en/docs/full-text-search).
- Aggregates take the percentiles `p50`, `p75`, `p90`, `p95` and `p99`, bucket a `datetime` by `minute` or `hour`, and filter on `$now` windows such as `$now-6h`. See [Grouping and Views](/en/docs/records-grouping-views).
- A column's `format: 'time-ms'` writes the time of day to the millisecond. See [Data Components](/en/docs/data-components).
- The `auth` action's `addToGroup` and `removeFromGroup` add an account to a declared group or remove it, from a step or from `context.actions.auth` in code; the console's Users directory gains **Change groups**, and `PUT /api/admin/users/:userId/groups` sets an account's membership. The directory's rows now carry the account's `groups`. See [Groups](/en/docs/auth-groups).
- Every step exposes `steps.<name>.durationMs`, `status` and `error` to the steps after it. See [Automations Overview](/en/docs/automations-overview).
- The `regenerateBackupCodes` form action replaces a reader's recovery codes, and a visibility condition compares `$user.twoFactorEnabled` with `true` or `false`. See [Two-Factor Authentication](/en/docs/auth-two-factor) and [Layouts and Access](/en/docs/pages-layouts-access).
- `onTwoFactor.navigate` on a `login` form sends an account that still owes its two-step code to a page of its own, and the code finishes the sign-in where that page's form, or else the sign-in form, was headed. A code page with no sign-in waiting says the sign-in has expired and links to `auth.loginPage`. The `auth-sign-in` library block now sends to `/two-step` (its new `twoStepPath`). See [Two-Factor Authentication](/en/docs/auth-two-factor).
- `sovrium deploy` follows a deployment the cloud tries again: it prints which attempt it is on and how the one before ended, waits through the `retrying` state, and exits `0` when a newer deployment has `replaced` the one it followed. A status it does not know is printed as is. See [Deploy to a Sovrium Cloud](/en/docs/deploy).
- `browser/run` drives a real browser through fixed steps, and with `selfHeal` a missed step is retried once with a locator a model suggests, reported for you to paste, never written into the config; `browser/agent` lets an AI agent drive it towards a goal; and the `browser.use` agent tool offers that agent to a chat. See [Browser Actions](/en/docs/automation-browser-actions), [Browser Agent](/en/docs/automation-browser-agent) and [Agent Tools](/en/docs/agent-tools).
- **Nothing changes on a server until you turn the browser on.** `BROWSER_PROVIDER` defaults to `off` on a server: a `browser/run` or `browser/agent` step fails with `browser_unavailable`, naming the variable to set, and no browser is ever started. Set `BROWSER_PROVIDER=webview` to let automations drive a browser. The desktop app turns it on by itself. See [Environment Variables: Browser Automation](/en/docs/env-vars-browser).
- **A browser is an optional dependency that Sovrium does not ship.** With the browser on, a server needs a Chrome, Chromium or Edge — installed on the machine and found on its own or named by `BROWSER_CHROME_PATH`, or running as its own service at `BROWSER_CDP_URL`. An install that never runs a browser step needs neither, and pays nothing for it: no browser starts before the first browser step.
- `sovrium deploy` no longer needs `--app`. It takes the app's address from the config `name`, then from the link remembered in `.sovrium/cloud.json`, and `--app` overrides both. When the app does not exist yet, it offers to create it, and outside a terminal it needs `--yes` to do so. Before uploading, it checks that every required environment variable is set on the cloud, and it ends only once the app answers at its public address. See [Deploy to a Sovrium Cloud](/en/docs/deploy).
- `sovrium deploy --env <file>` sets the app's variables from a file before deploying, and the new `sovrium env push <file>`, `sovrium env list` and `sovrium env unset <NAME>` manage them on their own. Only the names the config declares are sent, a value already set is kept unless you pass `--overwrite`, values are secret by default, and nothing but names is ever printed. See [A Hosted App's Variables](/en/docs/cloud-env).
- `SOVRIUM_API_KEY` and `SOVRIUM_HOST` take precedence over the credentials `sovrium login` stored, so a CI job signs its calls without writing anything to disk. See [Sign In to a Sovrium Cloud](/en/docs/login).
- `sovrium login` opens the browser and finishes in one click, through a listener on `127.0.0.1`. `--device` keeps the code flow, which the CLI also picks by itself over SSH, in CI or on a machine without a browser, and a cloud that does not offer one-click sign-in falls back to the code without being asked. See [Sign In to a Sovrium Cloud](/en/docs/login).
- For apps that turn on device authorization, the new `POST /api/auth/device/decide` endpoint approves or denies a one-click sign-in request, `/api/auth/device/code` accepts an optional `redirect_uri` and `device_name`, and `/api/auth/device/api-key` an optional `code`. See [Device Authorization](/en/docs/device-authorization).
- The `instance` action's `apply` operator now starts the app's socket unit before restarting its service. See [Instance Actions](/en/docs/automation-instance-actions).
- `SOVRIUM_PLATFORM_SSO_ISSUER`, `SOVRIUM_PLATFORM_SSO_CLIENT_ID` and `SOVRIUM_PLATFORM_SSO_CLIENT_SECRET` let an app hosted on Sovrium Cloud trust the Cloud to sign its admins in: the console sign-in page then offers **Sign in with Sovrium Cloud**. The Cloud sets them for the apps it hosts, and nothing changes while they are unset; setting only some of them refuses to boot, naming the missing ones. A config that declares a key starting with `SOVRIUM_PLATFORM_SSO_` under `env` is refused, because it would hand the client secret to every automation. See [Environment Variables: Hosting Under a Supervisor](/en/docs/env-vars-hosting) and [User Management](/en/docs/user-management).
- The first admin of an app deployed to Sovrium Cloud is the Cloud account that deployed it: with `SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT` set and `AUTH_ADMIN_EMAIL` set without a password, an app with no user creates its admin bound to that Cloud user, with no password and no bootstrap token. The account is bound by its Cloud user id, never by its email, and signing in never creates an account. `sovrium deploy` names the console to sign in to once the app is live. See [User Management](/en/docs/user-management).
- An admin who already has a password links their Cloud account with **Connect Sovrium Cloud account** on their profile page in the console, and can disconnect it as long as the password remains a way in. See [User Management](/en/docs/user-management).
- The `auth` action's `registerOAuthClient`, `rotateOAuthClientSecret` and `deleteOAuthClient` let a workflow manage the sign-in clients other apps use with the app as their provider: register one for a name and a return address, replace its secret, or delete it. The secret is passed to the next step and recorded as `***` in the run history. See [Auth Actions](/en/docs/automation-auth-actions).
- `sovrium seed --app <slug>` seeds an app hosted on a Sovrium Cloud from the `seed/` folder of the deployment it runs, and `--remote` seeds the app the project is linked to. A terminal asks before anything is sent, a script passes `--yes`, and `replace` takes a backup on the host first and asks for the app's address (`--confirm <slug>`). A plain `sovrium seed` still seeds this machine, even in a linked project. See [Deploy to a Sovrium Cloud](/en/docs/deploy#seeding-a-hosted-app).
- `sovrium deploy --seed` fills the app's empty tables from the bundle's `seed/` folder once the app answers at its address, in `if-empty` mode, so deploying again never overwrites your data. It cannot be combined with `--no-wait`. Without `--seed`, a deploy writes no rows. See [Deploy to a Sovrium Cloud](/en/docs/deploy).
- The `instance` action's `seed` operator loads a supervised app's seed data from the release it runs, as the app, and returns the report per table; `dryRun: true` reports the plan against the app's real data and writes nothing. See [Instance Actions](/en/docs/automation-instance-actions).
- `sovrium seed --report <file>` also writes the result as JSON, and `--request <file>` reads the mode, the tables, the day and the dry run from a JSON file instead of the flags. A run with `--report` prints each invitation with its email but not its link, on screen and in the file: send those invitations with **Resend** in the console. See [Seeding Data](/en/docs/cli-seed).

## Upgrading from 0.34 to 0.34.3

### Behaviour that changes without a config change

- **A count filtered by an `or` group now counts every record meeting at least one condition.** It counted only the records meeting all of them. A rollup or a lookup whose `filters` is an `and` / `or` group, which stopped the server at start, now boots and applies the group.
- **A rollup over a currency field now prints in that currency.** A SUM, AVG, MIN or MAX rollup over a `currency` field takes that field's currency and display settings, in the records API (`?format=display`) and on pages, where it printed a bare number or a dollar sign before. A rollup can also declare `currency`, `precision`, `symbolPosition`, `negativeFormat` and `thousandsSeparator` itself to override them.
- **A table view filtered by `isEmpty` or `isNotEmpty` without a `value` now applies that condition.** It showed every row.
- **A `flow/stop` with `status: error` — the default when `status` is omitted — now ends the run failed.** It used to store the run `completed` — or `completed-with-errors` after a step failed under `continueOnError` — at the top level, inside a path or a loop, whatever the trigger. The run now reads `failed`, with the stop's message as its error: every automation-failure trigger watching the automation fires, operators receive the automation-failure email, the run counts toward `SOVRIUM_AUTOMATION_AUTOPAUSE`, and a form submission the automation handled is recorded failed. `continueOnError` on the stop does not change this. A synchronous webhook caller still receives the stop's `{ status, message }` answer with HTTP 200, or the answer of an earlier `webhook/response`. Give every expected early exit `status: success`, and review any alert or filter that keys on `completed`, and any failure handler that will now see these runs.
- **A synchronous `automation/call` now fails when the called automation exhausts its retries, times out or is cancelled.** It used to fail only when the called automation failed outright; in the other three endings the call was recorded `completed` with an empty result and the calling run went on. The call step now fails, and the calling run fails with it unless the step is marked `continueOnError`.
- **A form submission is recorded `failed` whenever its bound automation ends in failure.** It used to read `done` when the automation used up its retries, timed out or was cancelled; only an outright failure recorded `failed`. Such a submission now reads `failed`, with the run's error as its reason, and no longer counts toward `maxSubmissions`.
- **Single-mode data sources now apply their `filter`.** A config that relied on it being ignored binds a different record.

## Upgrading from 0.33 to 0.34

Run `sovrium validate` with 0.34 before you restart: it refuses the configs below, naming the place to change.

### Configs that are refused

- **A step named `loop` or `loops` is refused.** These two names are now the template roots for loop items: `{{loop.*}}` is the innermost loop, and `{{loops.<loop name>.*}}` is any enclosing one. `sovrium validate` and startup refuse a step with either name, at any depth, naming the step and its path. Rename the step, and every `{{loop.…}}` or `{{loops.…}}` that read its output.

### Behaviour that changes without a config change

- **An upload key that only differs from a stored key by letter case or Unicode normalisation is refused.** A key you choose — an explicit upload `path`, a signed upload, or an automation's `file/upload` — is compared with the stored keys after Unicode normalisation, and also ignoring letter case when the local storage directory is on a case-insensitive disk (the macOS and Windows defaults), which Sovrium checks when it starts. A key landing on a file another key already names is refused instead of replacing that file: an upload answers `404` or `409`, and an automation step fails. Stored keys are not rewritten and stay readable as written; on a case-sensitive disk two cased spellings remain two files.
- **`$record.<attachment>` in a row template is now an address.** On a private bucket it is a signed download link valid for one hour; on a public bucket it is the bucket's files address. It used to print the storage key. A template that built an address around it (`/api/buckets/<bucket>/files/$record.<attachment>`) now nests one address inside another: write `$record.<attachment>.key` there, or use the bare token on its own. `sovrium validate` warns on each such token and names its place in the config.
- **An automation's record steps check the files they attach.** A record step writing an attachment key must name a file stored in that column's bucket, as a write through the records API already had to. A step running as the person who triggered it (`runAs: triggering-user`) must also name a file that person may download. Otherwise the step fails and nothing is written. To attach a file a `file/upload` step stored, give that step the column's `bucket`. A step that writes as nobody — a webhook, a schedule, a record event, with no `runAs` — may attach only a file its own run stored, or an inline value; a key that existed before the run now fails the step, where it used to be written. A file stored before an approval or a wait, or by the run that called it with `automation/call`, counts as existing before the run. This includes a generated document's `ifExists: skip` with `attachTo`, which no longer attaches a file an earlier run generated. Write the file again in the run (`ifExists: overwrite`), or run the step as a person.
- **Journal and log lines stay with admins wherever they are copied.** A later step that writes `{{steps.<health>.journal}}` or a logs step's `lines` into its own output no longer shows them to a reader who is not an admin; an admin still reads the run whole.
- **A run approved after a tolerated failure ends `completed-with-errors`.** A step that failed under `continueOnError` before an approval — at the top level, in a loop or in a path — used to be forgotten once the request was approved, and the run read `completed`. Review any alert or filter that keys on `completed`.
- **An inline `{ name, content }` value is stored on every attachment column.** It is stored as a file in the column's bucket instead of being kept as text, whether a records API call or an automation's record step writes it. It is held to the bucket's and the column's upload rules, and a `name` must be one file name: a value that breaks a rule, or whose content is not base64, is refused with 400.
- **Runs that used to end `completed` now end `completed-with-errors` when a loop skipped an item.** A loop with `continueOnItemError: true` still runs past a failed item, but the run no longer reads `completed` when one was dropped. Review any alert or filter that keys on `completed`.
- **Inside nested loops, `{{loop.item}}` is the inner item.** Before, a loop inside a loop read the outer item, and a later action inside a path within a loop read an earlier one as empty. Use `{{loops.<outer loop name>.item}}` for the outer item.
- **`DATABASE_POOL_MAX` is the instance's whole PostgreSQL footprint.** It used to size the request pool alone, and a start opened about twice that many connections, plus up to ten more for its migrations. Now the request pool takes what is left once one connection for migrations and maintenance and one for each AI listener the app declares are set aside: at the same value, it serves requests with `DATABASE_POOL_MAX − 1` connections, or fewer when the app uses the AI compute or knowledge listeners. Raise the value by that much if the request pool was sized exactly for your load. A value below 2, plus one for each of those listeners, now stops the start with a message naming the minimum. See [Environment variables](/en/docs/env-vars).
- **`$record.<field>` in page text prints a date, a date-time, an amount, a percentage, a yes/no, an option or a duration formatted.** A `date`, `datetime`, `created-at`, `updated-at` or `currency` field written into a component's text — and into a confirm's title and message, a `description-list` detail, a breadcrumb's current label, and the page's title and description — now reads in the page's language and the operator time zone (a `datetime` field that declares its own `timeZone` reads in that zone): `Mar 14, 2025`, `Mar 20, 2025 at 02:05 PM`, `€1,250.50`, as a `record-field` shows it, instead of the stored value. Links, attribute values, action inputs and type-to-confirm phrases keep the stored value, and on PostgreSQL a date there is now `2025-03-14` rather than `Fri Mar 14 2025 00:00:00 GMT+0000 …`. A `record-field` with no `format` now formats in the page's language rather than always in English, and a `datetime` field with its own `timeZone` in that zone. A `percentage`, a `checkbox`, an option (`single-select`, `status`, `multi-select`) and a `duration` field are formatted the same way: `12.5%`, `Yes`, the option's label rather than its stored value, the labels joined as the page's language writes a list, and `1:30`. A record drawer's children and confirm, a kanban card and a list or search item template, which the browser fills, now print every one of these values exactly as the server does, instead of the stored value. Write `$record.<field>.raw` wherever a sentence must keep the stored value. See [Page References](/en/docs/pages-references).
- **A component with its own `dataSource` reads its own record, not the page's.** On a page bound to one record — a `collection` page, or a page with `dataSource: { mode: single }` — a component that declares its own `dataSource` used to have `$record.<field>` in its text and `props` filled from the PAGE's record first, so it printed the page record's value for a field both tables share, and nothing for one only its own table has. It now prints its own record's value. Its `dataSource` filters still read the page's record. If a bound component's text was meant to quote the page's record, move that text to a sibling or a parent that declares no `dataSource`. See [Data Binding](/en/docs/pages-data-binding).
- **A webhook run no longer keeps the values of credential headers.** `cookie`, `set-cookie`, `authorization`, `proxy-authorization`, the header a webhook's `auth` names for its key or signature, and any header whose name contains `authorization`, `cookie`, `token`, `secret`, `signature`, `api-key`, `apikey` or `password` are recorded with the value `***`. The header's name is kept, so you can still see it was sent. A step reading one of them through `{{trigger.data.headers.…}}` now reads `***`: use `{{trigger.user.*}}` to know who called, and a connection or an `$env` secret to call another service. Authentication still checks the real value before the run starts. Runs recorded before the upgrade are shown, and replayed, with the same values hidden.

## Upgrading from 0.32 to 0.33

Two automation operators, and three delay lengths, are refused on 0.33 without a release in which they first warned. This is a named exception to the one release of notice a removal otherwise gets: one operator never did what its documentation promised, the other only changes family, and 0.32 silently cut each of those delays to one minute. Run `sovrium validate` with 0.33 before you restart, and rewrite each step it refuses with the `Removed | Replace with` tables below.

### Two file operators move to the `document` family

`file/generatePdf` is removed and `file/generateXlsx` moves to `document/generateXlsx`, with no alias and no warning release; `sovrium validate` and startup refuse either, naming the replacement. `filename` and `destination` become `output.filename` and `output.key`. A generated file is attached to a record or temporary: a `bucket` without `attachTo` is refused, naming the step (add `attachTo`, or drop `bucket`); without `attachTo` the file stays temporary and its `key` is written under `tmp/automations/` (`exports/latest.xlsx` becomes `tmp/automations/exports/latest.xlsx`); and `ifExists: overwrite` or `skip` only takes a file the same automation generated, failing the step on any other. `document/generatePdf` renders the HTML (`file/generatePdf` printed its text on one page), so it needs the document renderer (`RENDERER_*`):

| Removed             | Replace with                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `file/generatePdf`  | `document/generatePdf`: `template: { inline }` (or `{ asset }`, `{ key, bucket }`) and `data`, written with `output: { filename, bucket?, key?, attachTo? }` |
| `file/generateXlsx` | `document/generateXlsx`, with the same `data`, `sheets`, `columns` and `sheetName`, written with `output: { filename, key?, bucket?, attachTo? }`            |

### Delays longer than the engine keeps are refused

On 0.32 every delay was cut to one minute, without a word: a `24h` wait ran its next step a minute later. On 0.33 a `delay/wait` or a `delay/webhook` longer than one minute parks its run and resumes it from the database, for up to 90 days; a `delay/queue` still spaces its actions inside the running process. A length beyond what each can keep is refused, naming the automation, the step and the limit:

| Removed                                          | Replace with                                             |
| ------------------------------------------------ | -------------------------------------------------------- |
| `delay/wait` with a `duration` over 90 days      | Use a `cron` trigger that reads the records that are due |
| `delay/webhook` with a `timeout` over 90 days    | Use a `cron` trigger that reads the records that are due |
| `delay/queue` with an `interval` over one minute | Use a `cron` trigger that reads the records that are due |

### Behaviour that changes without a config change

Every config that validated on 0.32 and uses none of the operators or delays above still validates. Five behaviours change at runtime, and the output of two record steps changes shape (see the next section):

- **A wait longer than one minute parks its run instead of being cut short.** A `delay/wait`, or a `delay/webhook` `timeout`, longer than a minute now runs for its full length: the run reads `waiting-delay` and resumes within about a minute after its time, and a webhook that triggered it is answered at once with the run's id and that status rather than with what the later steps produced. See [Approval & Delay Actions](/en/docs/automation-approval-delay).
- **A required checkbox on a form must be ticked.** Every checkbox column a form binds now stores `true` or `false`, and a box left out of the post is stored as `false`. A checkbox marked required is treated as a consent: submitting it unticked is refused with 400 naming the box, and nothing is stored. Drop `required` from any checkbox that is not a consent.
- **A page's `access.redirectTo` sends only a visitor who has not signed in.** A signed-in person who lacks the required role is answered 404, as for a page that does not exist, rather than redirected. A page that relied on the redirect to send signed-in members elsewhere now needs a link to that place instead.
- **A port chosen on purpose is refused when it is busy.** With `PORT` set, `SOVRIUM_STRICT_PORT=1`, or under a systemd unit, `sovrium start` exits with status 1, naming the port and, when the system can tell, the process holding it, instead of quietly moving to another port the proxy in front never learns about. Stop the old server before you start the new one, as in the commands above.
- **Every write of a record fires the table's webhooks and record automations.** Records written by forms, the assistant, CSV imports, upserts, batch calls and automation steps now fire them, once per record, as a write through the records API always did. Review the record automations and webhooks that should not run when a file is imported, or set `import: { fireEvents: false }` on the table to make its imports silent. A webhook's payload is now the whole record whoever wrote it, narrowed only by the webhook's `includeFields` or `excludeFields`. Restoring a record from the trash fires a new `restore` event, which only a webhook or record trigger listing it receives. `sovrium seed` still fires nothing.

### A `user` field read by `record/list` or `record/read` is the person

On 0.32 a `user` field on a record a `record/list` or `record/read` step returned was the bare account id. It is now the person, as a record trigger already hands it over: `{ id, name, email }`, at the top level of the record and under `fields`.

| Where the step's output is read                                                             | On 0.32          | Now                                 |
| ------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------- |
| `{{<step>.record.<userField>}}` in a template                                               | The account id   | The account id, unchanged           |
| `{{<step>.record.<userField>.email}}`, `.name`                                              | Empty            | The person's email address and name |
| The whole output, handed to a `code` step's `inputData` or answered by a `webhook/response` | `"<account id>"` | `{ "id", "name", "email" }`         |

A template that renders the field keeps rendering the id. Before you restart, look for a `code` step or a webhook answer that treats a listed record's user field as a string, and read its `id`.

## Upgrading from 0.30 to 0.31

The view and form removals below are refused on 0.31 without a release in which they first warned: they were decided before Sovrium started giving one release of notice for a removal. From the next release on, a user-facing key that is going away first keeps validating for one release — `sovrium validate` and `sovrium start` print a warning naming its replacement and the release that will refuse it — and is refused only after that. For these two, run `sovrium validate` with 0.31 before you restart, and rewrite each key it refuses with the `Removed | Replace with` tables of the two sections below.

### Views belong to the table, and every data component binds to one or to the table

**A way of looking at a table is configuration declared on the table, never a feature of a page component and never something a reader saves.** A data component — `table`, `kanban`, `calendar`, `gallery`, `list`, `chart`, `kpi` — binds either to one of the table's `views[]` with `dataSource: { table, view }`, or directly to the table with `dataSource: { table }`. A board, a calendar and a grid of the same records are three components, each with its own binding. See [Views](/en/docs/table-views) and [Tables & Filter Bars](/en/docs/data-components).

Each of these validated on 0.30 and is refused by `sovrium validate` and at startup on 0.31, with a message naming the replacement:

| Removed                                                               | Replace with                                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `views` on a `table` (the grid / board / calendar / gallery switcher) | A `kanban`, `calendar` or `gallery` component beside the grid, each with its own `dataSource`                   |
| `viewLabels` on a `table`                                             | Nothing — there is no switcher to label; give each component its own heading                                    |
| `kanbanGroupBy` on a `table`                                          | `kanbanGroupBy` on a `kanban` component bound to the same table or view                                         |
| `dateField` on a `table`                                              | `dateField` on a `calendar` component bound to the same table or view                                           |
| `groupBy` on a `table`                                                | `groupBy` on one of the table's `views[]` (it now takes `thenBy` and `collapsed`), bound with `dataSource.view` |
| `toolbar.viewSwitcher`                                                | Separate `kanban`, `calendar` or `gallery` components                                                           |
| `toolbar.views` (the saved-views menu)                                | One of the table's `views[]`, bound with `dataSource.view`                                                      |
| `toolbar.columnToggle`                                                | The grid's `columns`, or the `fields` of the view it binds                                                      |
| `toolbar.density`                                                     | The grid's `rowHeight`                                                                                          |
| `toolbar.groupBy` (the runtime group-by picker)                       | `groupBy` on one of the table's `views[]`                                                                       |

A `dataSource.filter`, `dataSource.sort` or `dataSource.fields` written beside `dataSource.view` is refused too, naming the view: the view owns the filter, the sort, the grouping and the visible fields. Keep them on a component bound directly to the table. To move a grid's grouping, declare it on a view and point the grid at that view:

```yaml
# 0.30
- type: table
  dataSource: { table: deals }
  groupBy: { field: stage, thenBy: [{ field: owner }] }

# 0.31
tables:
  - name: deals
    views:
      - id: deals_by_stage
        name: Deals by stage
        groupBy: { field: stage, thenBy: [{ field: owner }] }
pages:
  - components:
      - type: table
        dataSource: { table: deals, view: deals_by_stage }
```

**Readers' saved views are gone, with their data.** The saved-views menu, sharing a saved view by link, and the per-reader table preferences (column widths, row density) are removed, together with their API routes under `/api/tables/:table/user-views`, `/api/shared-views/:id` and `/api/tables/:table/user-preferences`, and their two database tables, which the first start of 0.31 drops. Export anything a reader saved there before upgrading if you need to keep it; nothing reads it afterwards. A reader's search, filters and sort from a grid's toolbar still work and last for the visit: they are stored nowhere, neither on the server nor in the browser. **A grid bound to a view is editable by a reader the table lets write.** It reads through the view and writes to the table's records, on the fields the view shows; a reader without write access, and a visitor on a public view, still get a read-only grid. Export stays off on a view-bound grid.

### Two form surfaces, one job each: the page `form` no longer creates records

**A top-level `forms[]` entry takes something in; the page `form` component works on data already inside the app.** To let someone add a record from inside an app page — on the page, in a dialog, in a tab — declare the form in `forms[]` with `submitTo.table` and place it with `formRef`. The page `form` keeps editing the record a page shows (`dataSource` in `mode: single` with a `crud` update action), posting to an `endpoint` of your own, the sign-in and sign-up forms, `formRef` itself, `layout`, and per-field `label`, `description`, `placeholder`, `readOnly`, `disabled`, `hidden`, `defaultValue`, `control`, `options` and `optionsSource`. See [Forms Overview](/en/docs/forms-overview) and [The Form Component](/en/docs/data-components-forms).

Each of these validated on 0.30 and is refused by `sovrium validate` and at startup on 0.31, with a message naming the replacement:

| Removed from the page `form`                                             | Replace with                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `action: { type: crud, operation: create }` on a `form`                  | A `forms[]` entry with `submitTo.table`, placed with `formRef`                         |
| `onSuccess.type: reset` and `onSuccess.type: successPage` of that create | `forms[].onSuccess` with `type: reset` or `type: successPage`                          |
| `wizard`                                                                 | `forms[].layout: multi-step` with `steps[]`                                            |
| `fieldGroups`                                                            | `forms[].fieldGroups`                                                                  |
| `fields[].visibleWhen`, `fields[].requiredWhen`, `fields[].disabledWhen` | The same keys on `forms[].fields[]`                                                    |
| `fields[].accept`, `fields[].dropZone`, `fields[].maxFiles`              | An attachment field of a `forms[]` entry, with the same keys                           |
| `inlinePrefill` on a form declared in place (one without `formRef`)      | `inlinePrefill` on the `form` component that places the `forms[]` entry with `formRef` |

An attachment column on an edit form still draws its default upload control; only the upload options moved. To move a create form, lift its fields into a `forms[]` entry and leave a `formRef` where it was:

```yaml
# 0.30
pages:
  - name: Project
    path: /projects/:id
    dataSource: { table: projects, mode: single, param: id }
    components:
      - type: form
        dataSource: { table: tasks }
        fields:
          - { field: title }
          - { field: project }
        inlinePrefill: { prefill: { project: $parent.id }, lockPrefill: true }
        action:
          type: crud
          operation: create
          table: tasks
          onSuccess: { toast: { message: Task added, variant: success } }

# 0.31
forms:
  - id: 1
    name: new-task
    title: New task
    submitTo: { table: tasks }
    fields:
      - { kind: table-field, column: title }
      - { kind: table-field, column: project }
    onSuccess: { type: toast, variant: success, message: Task added }
pages:
  - name: Project
    path: /projects/:id
    dataSource: { table: projects, mode: single, param: id }
    components:
      - type: form
        formRef: new-task
        inlinePrefill: { prefill: { project: $parent.id }, lockPrefill: true }
```

**A submission made through a `formRef` embed no longer lands in the Submissions inbox.** On 0.30 every submission wrote a row to the built-in submission ledger, wherever it was made. On 0.31 a submission made through a `formRef` embed on an app page writes its table row and runs its automation, but writes no ledger row unless the form declares `submitTo.storeSubmission: true`. The form's own route still stores by default, and `storeSubmission: false` stores on neither. A form with `availability.maxSubmissions` keeps writing its row on every surface, because the cap is counted in the ledger. Where no row is written, `$submission.id` is empty in the success message and redirect. Add `storeSubmission: true` to any embedded form whose submissions you triage in the inbox. The OpenAPI document no longer lists `GET /forms/{formSlug}/embed`. That route had served nothing since the iframe embed was removed; a form is placed on a page with `formRef`.

### Values from requests and records are encoded where an automation places them

No config key changes and every config that validated on 0.30 still validates. What changes is the text an automation builds from data it did not write — a webhook body, a form submission, a record:

| Where the value lands                           | On 0.30                              | On 0.31                                                                               |
| ----------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `email/send` `to`, `cc`, `bcc`, `replyTo`       | Sent as written, separators included | Exactly one address per value or list item, else the step fails and nothing is sent   |
| `email/send` `from`                             | Any template                         | Written in the config or `$env.`; a value from run data fails the step                |
| `email/send` `body`                             | Inserted as markup                   | Shown as text; rich text through `{{{safeHtml value}}}`                               |
| An `http/*` or `webhook/send` `url`             | Inserted as it is                    | One path segment or one query value; a multi-segment path through `{{urlPath value}}` |
| A string body sent as JSON                      | Inserted as it is                    | Escaped as the content of a JSON string                                               |
| A `webhook/response` or `trigger.response` body | `<`, `>`, `&` sent as is             | Written as `\u003c`, `\u003e`, `\u0026` — the same value to a JSON parser             |

Before you restart, look for automations that place markup from data in an email body on purpose (wrap the value in `safeHtml`) or a nested path in a URL (use `urlPath`, a `query` object, or a URL that is a single template).

### A component's translation and prop keys are reported by name

A key under a component's `i18n` must be a language code (`fr`, `fr-FR`), and a key under its `props` a camelCase property name or a kebab-case `data-*` or `aria-*` attribute. Such a mistake already stopped `sovrium validate` and startup on 0.30, but was reported as an unknown property with an empty list of accepted keys. On 0.31 each mistyped key is named with the spelling it must match, all of them in the same run:

```text
Language code must be two lowercase letters, optionally followed by a hyphen and a two-letter uppercase region (pattern ^[a-z]{2}(-[A-Z]{2})?$, e.g. fr, fr-FR)
```

The same holds for every other map whose keys follow a rule: the language codes and keys of `languages.translations`, a page's `meta.i18n` languages and the attribute names of its `meta.customElements`, its `scripts.features` flags, a component's breakpoint `responsive.<size>.props` and a reused block's `vars`, and the face names of `design.typeScale.families`. Each mistyped key is refused as `Key '<key>' is not accepted`, followed by the rule it breaks, at its own path. A config that validated on 0.30 is unaffected. A program that decodes a component outside the CLI, through the published JSON Schema, now sees the key pattern as `propertyNames` instead of `patternProperties`, so a mistyped key fails there too rather than passing unchecked.

## Roll back

Because migrations do not reverse, a rollback restores the pre-upgrade backup with the prior binary or image. `--force` replaces the migrated data directory and config; the backup's checksums are verified before anything is replaced:

```bash
sovrium stop
curl -fsSL https://sovrium.com/install | sh -s -- --version 0.24.0   # the version you upgraded from
sovrium restore /backups/pre-upgrade.tar.gz --force
sovrium start app.yaml
```

For **zero downtime**, run the new version as a second instance behind your proxy, verify it, then switch traffic — keeping the old instance until you are confident.

## Next

- **Schema Migrations** — why released migrations are immutable.
- **Back Up and Restore** — `sovrium backup` and `sovrium restore`, the backup this guide relies on.
- **CLI Overview** — `update`, `validate`, `stop` and `start`.
- **Upgrade Notes for Earlier Releases** — what changed in older releases, for an app that skips several versions at once.
