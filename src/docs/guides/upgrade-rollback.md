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
