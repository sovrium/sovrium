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

A refusal names the place in the config and, in most cases, what to write instead. Fix it, validate again, then restart. Environment variables are read when the server starts rather than by `validate`, so an invalid one surfaces at `start`, before the app serves traffic.

Then read the breaking changes between your version and the new one — `sovrium changelog --since <the version you run>` gathers them in one list.

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

A `dataSource.filter`, `dataSource.sort` or `dataSource.fields` written beside `dataSource.view` is refused too, naming the view: the view owns the filter, the sort, the grouping and the visible fields. Keep them on a component bound directly to the table.

To move a grid's grouping, declare it on a view and point the grid at that view:

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

**Readers' saved views are gone, with their data.** The saved-views menu, sharing a saved view by link, and the per-reader table preferences (column widths, row density) are removed, together with their API routes under `/api/tables/:table/user-views`, `/api/shared-views/:id` and `/api/tables/:table/user-preferences`, and their two database tables, which the first start of 0.31 drops. Export anything a reader saved there before upgrading if you need to keep it; nothing reads it afterwards. A reader's search, filters and sort from a grid's toolbar still work and last for the visit: they are stored nowhere, neither on the server nor in the browser.

**A grid bound to a view is editable by a reader the table lets write.** It reads through the view and writes to the table's records, on the fields the view shows; a reader without write access, and a visitor on a public view, still get a read-only grid. Export stays off on a view-bound grid.

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

An attachment column on an edit form still draws its default upload control; only the upload options moved.

To move a create form, lift its fields into a `forms[]` entry and leave a `formRef` where it was:

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

**A submission made through a `formRef` embed no longer lands in the Submissions inbox.** On 0.30 every submission wrote a row to the built-in submission ledger, wherever it was made. On 0.31 a submission made through a `formRef` embed on an app page writes its table row and runs its automation, but writes no ledger row unless the form declares `submitTo.storeSubmission: true`. The form's own route still stores by default, and `storeSubmission: false` stores on neither. A form with `availability.maxSubmissions` keeps writing its row on every surface, because the cap is counted in the ledger. Where no row is written, `$submission.id` is empty in the success message and redirect. Add `storeSubmission: true` to any embedded form whose submissions you triage in the inbox.

The OpenAPI document no longer lists `GET /forms/{formSlug}/embed`. That route had served nothing since the iframe embed was removed; a form is placed on a page with `formRef`.

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

The same holds for every other map whose keys follow a rule: the language codes and keys of `languages.translations`, a page's `meta.i18n` languages and the attribute names of its `meta.customElements`, its `scripts.features` flags, a component's breakpoint `responsive.<size>.props` and a reused block's `vars`, and the face names of `design.typeScale.families`. Each mistyped key is refused as `Key '<key>' is not accepted`, followed by the rule it breaks, at its own path.

A config that validated on 0.30 is unaffected. A program that decodes a component outside the CLI, through the published JSON Schema, now sees the key pattern as `propertyNames` instead of `patternProperties`, so a mistyped key fails there too rather than passing unchecked.

## Upgrading from 0.29 to 0.30

### Public pages in an app with `auth`

**A public page shows signed-out visitors no rows of a table whose `read` is not `all`.** On 0.29.1 a server-rendered page drew such a table's rows to a visitor who was not signed in — a table with no `permissions` block included — while the records API answered her `401`. 0.30 holds every page to the API's answer. For that visitor, a list or a search over the table shows nothing; a grid renders empty, without its columns; a board, calendar, gallery, chart, timeline or record drawer is left out of the page; a KPI keeps its card and its label, without its figure; a page bound to one of the table's records answers `404`; and `/feed.xml` carries no item from it. To keep a table's records on a public page, declare `read: 'all'` on it, on the table or through `inherit`. An app with no `auth` block is unchanged. See [Data Binding](/en/docs/pages-data-binding) and [Table Permissions](/en/docs/table-permissions).

- **A table that inherits a public grant is now reachable by signed-out visitors**; to keep it closed, override `read` or `create` on that table. A visitor is judged on the grants a table resolves to once `inherit` and `override` apply — on its records, its comment thread and its pages alike — where 0.29.1's records API and comment thread read only the table's own block.
- **Visitors are refused where `inherit` or `override` narrows a table to signed-in callers**, even when the table's own block says `all`: its records and its comment thread answer `401`, and nothing a visitor sends is stored.

### Configs now refused

Each of these validated on 0.29.1 and is refused by `sovrium validate` and at startup on 0.30:

- A form's or a button's address — a redirect after submission, a success-page button or redirect, a success page's link button, a closed form's link, a `navigate` action — that is neither an `http://` or `https://` address nor a path on this site. `javascript:`, `data:`, `mailto:` and `//host` addresses are refused; a template variable may fill the path or the query, never the start of the address.
- A `component:` placement whose name matches no template in `app.components`.
- An `auth.defaultRole` that is neither a built-in role (`admin`, `member`, `viewer`) nor a role declared in `auth.roles` — now checked even when `auth.roles` is absent — and any admin-tier name (`operator`, `admin-editor`, `admin-viewer`) as a default.
- Two table names stored as the same table (`Open Deals`, `open_deals` and `open-deals`), and a table name holding whitespace other than a plain space.
- A table-level `unique` entry naming a field the table does not declare, and a table-level foreign key naming a table or a field that does not exist.
- Two tables whose lookups, rollups or counts read each other.
- Two automations whose writes start each other with no trigger condition on either.
- An approval with `onTimeout: escalate`, or with a `timeout` and no `onTimeout` — including one nested in a branch or a loop.
- A digest release sorting on a key written as a JSON path (starting with `$`), or on an empty key.
- A calendar `colorField` naming a multi-select field.
- Inside a board or gallery card: a data component (a table, a list, a chart…), or a QR code whose `size` is not a whole number of pixels above zero or whose error-correction level is other than `L`, `M`, `Q` or `H`.
- A chart with `chartAggregate` and more than one `series` entry.
- A page component's `dataSource` filter value starting with `$today` or `$startOf` that is not one of the relative dates: `$today`, `$today+14d`, `$today-2w`, `$startOfMonth`, `$startOfNextMonth`.
- A custom `auth.emailTemplates.accountDeletion` with no `$url` in a part it supplies, or with no body, while immediate account deletion is on.
- A view with a text id or a `query` whose id is also a table's name, the id of another table's view, a many-to-many link table's name or the name of a table the engine keeps for itself. Such an app validated but failed to start; `sovrium validate` now names both sides.
- An approval reached through an action template, or nested in a loop or a branch, in an app with no `auth` — as a top-level approval step already was, since nobody could sign in to answer it.
- A `rowLevelPermissions` rule on a multi-select field, and a rule value whose type does not match its field: text on a number field (write `12.5`, not `'12.50'`), anything but a `YYYY-MM-DD` day on a date field, anything but the stored UTC instant (`2026-10-01T09:30:00.000Z`) on a date-and-time field, and text on a checkbox (write `true`, not `'true'`). A `$currentUser` value stays valid on any field.
- A row rule (`rowLevelPermissions`) naming `$currentUser.activeAssignment` now stops `sovrium validate` and the boot. It never matched a record — no row rule resolves the active scope — so the table it guarded read as empty. Rewrite it with `$currentUser.assignments.<table>` (operator `in`); the active scope stays available in page data-source filters.
- A `$env.NAME` anywhere in the configuration — a connection, an incoming or outgoing webhook's `auth`, a link password, an automation action, an action template — naming a variable the app does not declare in `app.env`. Such a reference used to send an empty value silently, for instance an empty secret, and an outgoing table webhook's `auth` secret, key or token read the server's environment directly. Declare the variable in `app.env` and the app boots again with the same value; an outgoing webhook now also falls back to the variable's declared `default`.

The published JSON Schema (`sovrium schema`) now also rejects a key that breaks its naming pattern in 14 keyed maps — among them `languages.translations`, a component's `props` and `i18n`, and a page's `meta.i18n` and `scripts.features` — as `sovrium start` already did at boot, so an editor may now underline a config the server was already refusing; no running app changes behaviour.

Markdown renders as before apart from four corrections in the upstream parser, in markdown pages, text components with `format: markdown`, and form descriptions and help text. A bracketed IPv6 address such as `http://[::1]:8080/` now becomes a link and keeps its brackets. Inline code in an image's alt text keeps its words, where it used to drop them. A code span of three or more spaces keeps every space, where it used to shrink to one. A bare URL whose path closes nested parentheses, such as `https://en.wikipedia.org/wiki/A_(b_(c))`, now keeps its last `)` in the link. Text glued straight after that parenthesis stays outside the link, so a word, a comma or a markdown link written right after it is not swallowed; a `/`, `?` or `#` there still continues the URL.

The API explorer at `/api/scalar` looks and behaves as before, but it now loads the reference viewer as an ES module, `https://cdn.jsdelivr.net/npm/@scalar/api-reference/esm.js`, where it used to load the classic script at `https://cdn.jsdelivr.net/npm/@scalar/api-reference`. Neither address pins a version, so the CDN serves its current release. If an outbound proxy or a Content-Security-Policy allows that CDN by path, allow the new file too. An instance with no internet access still cannot load this page, as before; the OpenAPI documents themselves need no CDN.

### Environment now refused at startup

`RATE_LIMIT_WINDOW_SECONDS` set to anything but a whole number of seconds above zero stops the server from starting; it used to switch the per-address rate limits off silently. Leave it unset, or empty, for the 60-second default. The new `API_IP_RATE_LIMIT` is held to the same rule: a whole number above zero, or unset for the default.

### Records API requests

- **Record ids and relationship values are strings** on every wire — the records API, webhooks, real-time events, automation triggers and AI chat. Code comparing an id with a number stops matching; see Records Overview.
- **Stored formulas are recomputed once**, on the first start after the upgrade: 0.30 computes some formulas differently, so every formula column is recomputed for the rows already in its table. No automation runs and no row's modification time moves; on a large table, expect that first start to take longer. See [Formula Fields](/en/docs/formula-fields) and [Migrating a Database](/en/docs/cli-migrate).
- **A records `filter` must be an `and` list.** A flat object (`{"status":"active"}`), a lone condition, a bare array or a top-level `or` answers `400`, on the live listing and in the trash; each used to be read as no filter and returned every row. See [Filtering, Sorting and Pagination](/en/docs/records-filtering-sorting).
- **An unknown filter operator answers `400`**, naming it and the supported ones, instead of filtering by equality; `isTrue` and `isFalse` on a field that holds no boolean answer `400` too.
- **The trash listing applies every filter operator** the live listing does; `in`, `startsWith`, `endsWith` and the emptiness and boolean operators used to be skipped, returning more rows. See [Soft Delete and Restore](/en/docs/records-soft-delete).
- **`sum` and `avg` over a field that is not a number answer `400`**, naming the field; see Grouping and Saved Views.
- **A field the caller may not read and a field the table does not have answer alike**: in `filter`, `sort`, `groupBy` or `aggregate`, both get the same `404`, and in `fields` both select nothing where an unknown name used to answer `400`. A sort on a hidden field used to order rows by its value.
- **You may sort by every field you may read**, field grants, group grants and the built-in defaults included; a sort on a field you may not read still answers `404`.
- **Every `404` from the API has one body**, `{ success: false, error: "Not Found", message, code: "NOT_FOUND" }`, including an `/api/` path no route matches, which used to answer the HTML not-found page; see REST API Overview.
- **API requests are capped per client address**, ahead of every session lookup: 1200 per `RATE_LIMIT_WINDOW_SECONDS` window by default, shared with the MCP endpoint and with page and console requests that carry a credential. `API_IP_RATE_LIMIT` raises it when many users share one address; every per-address limit now counts an IPv6 client by its /64. See [Security Hardening](/en/docs/security-hardening).
- **A view someone shares is masked for its reader**: `GET /api/shared-views/<view>` keeps only the columns, filter conditions, sorts, grouping and column widths on fields the reader may read, and drops a filter entry it cannot read as a condition; a view the reader may not open still answers `404`. See [Runtime Data Customization](/en/docs/runtime-customization).
- **A refused CSV export answers `404`**, with the body of a table that does not exist, where it answered `403`.
- **A signed-out visitor asking for `?includeDeleted=true`** on a table whose `read` is `all` gets `401`, as `?deleted=true` already did, and no deleted row; see Soft Delete and Restore.
- **A batch update or upsert that fails leaves nothing in the activity feed**, on both databases. Its entries are now written once the batch has committed; a batch that failed part-way used to leave entries for the records it had changed before the failure, although the rollback had undone those changes.

### Who may read and write a table

- **The app's highest role now opens every door the built-in `admin` opens.** A custom role at level 80 or above that tops the app is admin-equivalent, and these doors asked for the literal `admin` and refused it (`404`, or `401` from `/api/analytics/events`): a table grant that does not name it, wherever a table is read or written (records API, views, pages, AI chat, agents, MCP tools); a bucket grant, and the admin-only default for `sign` and `signUpload`; a form export's field read grants and revealing a submission's body; reading, moderating and deleting others' comments, pending ones included; the `user_access` routes; a connection's user roster; the knowledge rebuild; the analytics reads; the MCP internals, audit list and config tools, which it is now offered; an agent's `trigger` grant; and running a manual automation that names no role, or a cron automation on demand. The built-in `admin` keeps every one of these rights in an app whose custom role outranks it. Every other role is unchanged, and the operator console keeps its own tier: a role it admits reads every console page, but the analytics figures and the admin-only features in it need an admin-equivalent role. See [Roles & RBAC](/en/docs/auth-roles-rbac) and [Admin Dashboard](/en/docs/admin-dashboard).
- **Every door onto a table admits exactly the callers its records admit.** The permissions map, an upsert, the comment thread and a new comment, the MCP tools, a restore and a batch restore, the delete form and a record button now count the caller's groups and — on a table with row-level rules — the roles her assignments give her, as the records API does; some of them ignored one or the other. Groups and assignments are read on every request, so a withdrawn membership stops counting on the next one. See [Groups](/en/docs/auth-groups).
- **A role an assignment gives counts only on a table with row-level rules.** An automation started by hand or by a record button used to count it on any table; on a table without row-level rules a write that relied on it is now refused. Declare row-level rules on that table, or grant the operation by role or by group. The MCP tools now count assignment roles on a table with row-level rules, where they ignored them.
- **A role a user holds only through a `user_access` assignment no longer opens, on a page or in a hosted form, the records of a table that declares no row-level rules** — the records API already refused them. A page bound to such a record answers `404`, and a form embedded with a locked `inlinePrefill` on its page answers `422`, as for a record that does not exist. Declare row-level rules on that table, or grant `read` by role or by group.
- **A rule on `$currentUser.email` now matches the reader's own email on every door** — the records API (single records and lists), pages, hosted forms, the MCP tools and real-time — where the records API refused her own records, and it **no longer matches records whose field is empty**, which it served to every reader. A rule naming a value the reader does not have, such as an active assignment, matches nothing.
- **On a table open to everyone, a rule naming `$currentUser` no longer matches anything for a signed-out visitor** — it used to match a placeholder identity, so a rule such as `audience eq $currentUser.role` or `owner neq $currentUser.id` served her records on the records API. Give such a table a read rule that admits its public records without naming the visitor.
- **A lookup into a table its reader may not read, or of a related field that reader may not read — a related formula built on such a value included — now comes back empty, as a relationship label already did** — it used to show the related value. A formula built on such a lookup, or on a lookup through a linked record the reader's row-level rule hides, now comes back empty with it; a filter, sort, grouping or aggregate on that formula reads it as empty for every record. A lookup through a linked record the reader's row-level rule hides comes back empty too, and a lookup of another lookup follows every record it reads through: it comes back empty when the row-level rule of any of them hides it. A filter, sort, grouping or aggregate on a lookup of a lookup sees its value on the records the reader may read through every hop and reads it as empty on the others, so it never matches, orders or counts a hidden value. A lookup that copies a list from another table — through a many-to-many link or a link back, or a lookup of such a list — is narrowed to the linked records the reader may read, and comes back empty when none remains; a filter, sort, grouping or aggregate on a lookup of such a list sees the same narrowed list — the reader's readable names, never a hidden one — on SQLite and PostgreSQL alike.
- **For a reader a row-level rule narrows, a filter, sort or grouping on a many-to-many lookup — or a lookup copying one — now compares the list exactly as she is shown it**: in the display's order (numbers by size, text by character code, so capitals before lowercase and accented letters after both), with no empty items. On PostgreSQL a saved filter value copied from the old order may need re-copying from the screen.
- **The response to a write (create, update, restore, batch, upsert, and the MCP write tools) now leaves out what the writer may not read, as her read of the record does** — it used to echo it.
- **A rollup or count into a table its reader may not read, or over a field she may not read, now comes back empty** — it used to show the aggregate (and, over one record, the value itself). A formula built on such a rollup or count comes back empty with it. Within a table she may read, it still counts every related record, as before. To keep showing a public total drawn from a table its readers may not read — seats taken, orders received — store that total in a number field of the public table, and keep it current with an automation that recounts it whenever a related record is created, changed or deleted. The events template shows the pattern.
- **A single read now opens every record its reader's list shows** under a row-level rule on a column she may not read, where it answered `404`; the column itself stays hidden from her.
- **The app's top role passes a hosted form's parent check as it does on the page**: a form embedded with a locked `inlinePrefill` accepts a submission from it on a record its role reads through the row-level bypass, where it answered `422`.
- **A malformed access grant answers `400`** with a generic message on the `user_access` routes, instead of a `500` that echoed the database's text. A client that matched that text must read the status instead.
- **The `viewer` role writes only where a table names it; grants reaching her through a group or an assignment are read-only.** She is refused `create`, `update` and `delete` on every road a record is written by — the records API and its batch routes, restore, the delete form, a record button, the MCP tools, an automation she starts and AI chat — with a `404`, and pages no longer offer her those writes. A grant naming `viewer`, or `all` / `authenticated`, still admits her, and now on the batch routes too, which refused her. See [Table Permissions](/en/docs/table-permissions).
- **Permanent delete and purge are reserved to admin-equivalent roles** — the app's highest role (a custom role at level 80 or above, else `admin`) and the built-in `admin` — for `?permanent=true` and `?purge=true` on one record and `permanent: true` on both batch delete routes. A purge used to need only the `delete` grant: anyone else now gets the `404` of a missing record and nothing is erased, while `delete` still trashes. A custom top role now deletes permanently, which only the literal `admin` could. See [Roles & RBAC](/en/docs/auth-roles-rbac) and [Upsert and Delete](/en/docs/records-upsert-delete).
- **An update answers to the row-level `read` rule as well as `write`**: a record the `read` rule hides from the caller is refused as a missing one (`404`, nothing written) on `PATCH`, from the record drawer's save and through AI chat, as an edit form's save, a batch update and an upsert already were.
- **A table definition names only the fields the caller may read**: `GET /api/tables/<table>` leaves the others out of `fields`, and leaves out `primaryKey` when that field is unreadable. On a table with no field rules the built-in defaults decide, as on the records API: a `viewer` reads only fields named `name` or `title` plus the system fields, and a `member` does not read a currency field named `salary`. See [Table Permissions](/en/docs/table-permissions).
- **`GET /api/tables/<table>/permissions` answers `404` to a caller who may not read the table**, with the same body as a table that does not exist; it used to answer `200`. A `200` now always carries `table.read: true`.
- **Its `fields` map lists one entry per field the caller may read**, each `{ read: true, write: … }`, and none for a field it may not read. `write` is now exactly what a write of that field would be allowed: a field whose rule sets only `read` reports `write: true` where it reported `false`, a custom top role that counts as admin gets `write: true`, and a field whose `write` names a group reports `write: false` to that group's members. A client that treated a missing entry as writable must now treat it as not readable: such a field is writable only through an explicit `write` grant naming the caller's role.
- **A field `read` grant naming a group is honoured**: a member of the group named in `read: ['group:finance']` now receives the field on record lists, single records, the trash, CSV export, search, `filter`, `sort`, `groupBy` and `aggregate` (`200` where it was `404`), the records a write hands back, record history, the table definition, view definitions, the permissions map and the MCP record tools. A caller admitted to a table only through a group grant now gets `200` from `GET /api/tables/<table>`, its views list and its permissions map. A field `write` audience is still matched against the role only, so a `group:` entry there admits nobody but an admin; see Groups.
- **Writing a field you may not read is refused** unless that field's `write` rule names your role, on every road a record is written by: the records API (single, edit form, create, batch, bulk update, upsert), the MCP create and update tools, an automation started by hand, the record drawer and AI chat. The refusal is the one a `write` rule gives: `404` on the records API, invalid params on MCP. On a table with no field rules the built-in defaults decide: a `viewer` granted create or update writes only a single-line-text field named `name` or `title`, and a `member` no longer writes a currency field named `salary`. AI chat, which refused a field whose rule sets only `read`, now accepts it from a caller who may read it. See [Table Permissions](/en/docs/table-permissions).
- **On a table you may not read, writes to stored records answer `404`** — an update by `PATCH`, the edit form, the batch route or bulk update; a delete by `DELETE`, the delete form, either batch delete route or bulk delete; and an upsert on either branch — with the body of a missing record, and nothing is written or deleted. The MCP update and delete tools answer such a call as one naming a record that does not exist and hand back nothing of the record. A caller who may only create must use a plain create, not upsert. See [Upsert and Delete](/en/docs/records-upsert-delete).
- **A create on a table you may not read answers `201` with `{ "created": 1 }`** (or `{ "created": <count> }` from the batch route) instead of the stored record: no value, no record id. A refusal that would describe the table — a malformed body, an unknown or missing field, a refused value, a duplicate unique value — answers the `404` of a table that does not exist, so a form that creates there shows "Resource not found" where it showed the value error. See [Create, Read and Update](/en/docs/records-crud) and [Batch Operations](/en/docs/records-batch).
- **A signed-out visitor's create on a table whose `read` is not `all` answers `{ created: 1 }` only**, and can no longer link to a record in a table she may not read — such a link is refused like one to a record that does not exist.
- **The table's read check runs before request validation**: on a table you may not read, any request — a malformed one included — and your saved views and preferences there answer the `404` of a table that does not exist, never a `400` or a `200`.
- **An operation a table's `permissions` block leaves out is refused under row-level rules too**: on a table with `rowLevelPermissions`, an undeclared operation is refused to non-admins as soon as the block names any operation, and grants the table `inherit`s or `override`s are honoured. Such operations used to stay open to every non-viewer. A refusal answers `404`.
- **An empty value satisfies no row-level rule, `neq` included**: a record whose ruled field is empty, which the list already left out under a `neq` rule, now answers `404` by id too — on a single read, an update, a delete, a restore, the history, comments, the MCP tools and real-time — and its activity entries are left out of the feed. A create whose body omits a field a `create` rule compares with `neq` is refused (`404`) unless that field has a `default`, which now counts. In the mcp-server template, a document whose `status` someone clears becomes visible to its author only.
- **A restore is judged on the trashed row**: under row-level rules the `read` and `delete` rules must admit the caller on the single and the batch restore, so a scoped user can no longer restore another's record; a batch naming one such row restores nothing.
- **A view with no `permissions` block follows its table's `read`**: it answers exactly the callers the table's records answer, and anyone else gets the `404` of a missing view. It used to be open to every signed-in role. A view with its own grant keeps it, and that grant now admits the members of a `group:` it names. `?view=` on the records list applies the same check. See [Views](/en/docs/table-views).
- **A saved view shared by id (`GET /api/shared-views/<id>`) opens for every caller its table's records admit**: on a table with row-level rules, a reader whose read grant comes from her assignment role now gets the view (`200`) where she got `404`. Its definition is still masked to the fields she may read.
- A reader whose role comes from an assignment now opens a shared-view link of a table with row-level rules, as the records API already admitted her; on a table without row-level rules an assignment role still opens nothing.
- **`GET /api/tables` answers every signed-in role**, viewer included, naming exactly the tables whose records the caller may read — a table that declares no `read` included, for every caller its records serve; a caller with none gets `200` and an empty list. `GET /api/tables/<table>` and the views list answer exactly the callers the table's records answer, so an `override` that hides the records hides the definition too; see Endpoint Reference.
- **Reading one comment by id follows moderation**: a pending or rejected comment answers a non-admin `404`, and every comment carries its stored `status` where it always read `approved`. Guest comments no longer open a thread whose table keeps its `read` (or `comment`) to signed-in callers or roles: a signed-out visitor gets `401` there. See [Record History and Comments](/en/docs/record-history) and [Social Components](/en/docs/social-components).
- **Webhook management answers admin-equivalent roles only**: the list of a table's webhooks, a delivery log, one delivery, a retry and a test send. Every other signed-in caller gets the `404` of a table that does not exist, and a retry or test from them sends nothing. In an app without `auth` these routes answer `404` to every visitor, so they are out of reach over HTTP. Webhooks are still configured in the config file and still deliver; no CLI command lists their deliveries. See [Table Webhooks](/en/docs/table-webhooks).
- Batch signing (`POST /api/buckets/{bucket}/sign/batch`) now checks every entry against the bucket's `sign` and `signUpload` permissions, as the single form does. Left undeclared they are admin-only, so if non-admin users batch-sign on a bucket, declare `sign` on it (and `signUpload` for uploads), for example `sign: ['member']`. Batch upload entries now work: they accept `contentType` and `maxSize`, and the upload URLs they return can be used. An entry with no path, or a path that is not text, now refuses the whole request with `400` and `Missing path`, as the single form does, where it used to be signed anyway.
- **Signed URLs issued before the upgrade stop working**: they answer `403`. A signed URL lasts at most seven days, so re-sign the ones you still need after upgrading. The signature now binds each of its fields separately, so a file whose name spells out another operation can no longer yield a URL valid for that operation. Attachment URLs returned by the records API are signed afresh on every read and need nothing.

### Pages

- **The sitemap judges a table by the read its inheritance resolves to**: a table that only inherits `all` is now listed, and one overriding to `authenticated` no longer is. See [Crawlers, Sitemaps & Feeds](/en/docs/seo-crawlers).
- **`/feed.xml` carries only what a signed-out reader may read**: no item from a table she may not read, no record the row-level rule hides from her, none from the trash, and no field restricted to a role in a title, description or link. See [Crawlers, Sitemaps & Feeds](/en/docs/seo-crawlers).
- **No page draws a record from the trash**: lists, searches and pagers leave it out, a `mode: single` component draws nothing of it, and a page bound to it answers `404`.
- **Rows drawn on the server follow the visitor's row-level read rule and field permissions**, as the records API lists them: lists, a container's per-row children, searches, data-bound sidebar sections and pagers. A row the rule hides is neither drawn nor counted. See [Data Binding](/en/docs/pages-data-binding).
- **A server-rendered list over a table with a row-level rule returns only the `fields` its binding lists** — list every column your page uses, `id` included.
- **A component over a table its reader may not read carries nothing of it**, for a signed-in reader as for the signed-out visitor of a public page above: the grid renders empty, the board, calendar, gallery, chart, timeline or record drawer is left out, and the KPI keeps only its card and label.
- **A component drops what it would build on a field its reader may not read.** A board grouped by it is drawn ungrouped in one column; a hidden colour field leaves cards, events and bars uncoloured; a hidden lane or timeline grouping draws no lanes; a card line, footer item, series entry or click path built on it is left out. A calendar whose `dateField`, a timeline whose `startField` or a chart whose category or plotted value she may not read is left out of her page, and a KPI aggregating such a field keeps its label and shows no value instead of falling back to a count. A grid no longer offers her a board or calendar view built on such a field. See [Kanban Boards](/en/docs/data-components-boards), [Calendars](/en/docs/data-components-calendars) and [Charts](/en/docs/data-components-charts).
- **No page names a field its reader may not read** — not its name, label or options, neither in what a component draws nor in the configuration the page hands its scripts. The page markup no longer carries the engine's internal `data-_…` attributes (`data-_unreadable-fields` among them), which named such fields; a script of yours that read one finds nothing. A grid's page payload carries her own views, masked, her own fields and her permission map instead of the table's `permissions` block. A signed-out visitor on a public page is held to the same rule.
- **A page over a table only signed-in members may read no longer hands signed-out visitors its field names and types.**
- **Pages offer an input only on a field their reader may write**: a create form, an edit form, a grid's trailing row, create dialog and auto columns, and a record drawer. An edit form shows a field she may read but not write without an input, and saving leaves it as it was; when the table does not let her update the record at all, it shows her readable fields disabled, with no save button. An editable column she may not update has no editor, and a drawer whose fields are all read-only for her has no Save button.
- **`redirectToFirst` lands on the first row its visitor may read**, and renders the page as for an empty collection when there is none. A `mode: single` binding with no `param` shows the first record the visitor may read, where a hidden first row answered `404`.
- **A row the row-level read rule hides answers like a missing one**: a collection page addressed to it answers the `404` page, where a signed-in reader got an access-denied page with `200`, and a record drawer opened on it says the record could not be found and offers nothing to save. See [Collection & Markdown Pages](/en/docs/pages-collections) and [Overlay Components](/en/docs/overlay-components).

### Forms

- **A form's choices from a table follow that table's row-level read rule for each visitor**, signed in or not, on its own page, each step and a `formRef` embedding. Publishing a form still publishes its choices, even from a table its visitor may not otherwise read, but the rule filters them: the choices offered and the links submitted alike. A public form whose relationship points at a table with a rule naming the signed-in person (`owner_id = $currentUser.id`) may lose its choices for an anonymous visitor; give that table a read rule that admits those rows without naming the visitor. See [Form Fields](/en/docs/form-fields).
- **A submitted link to a row the rule hides is refused** exactly as a link to a row that does not exist, and nothing is stored.
- **A form embedded with a locked `inlinePrefill` refuses a page record its submitter may not read**: on submit, a parent record in the trash, or one the table's read grant or row-level rule hides from the person submitting, is answered `422` exactly as a parent that does not exist, and nothing is stored. A trashed parent used to be accepted.
- **A form bound to a record prefills only the many-to-many links its visitor may read**: a link into a table she may not read, or to a record in the trash, is dropped.

### Automations

- **A webhook trigger's default answer names the run and nothing it read.** On the synchronous path (`respondImmediately` off), a call is now answered `{ id, status }` alone. It used to carry `success` as well, plus the last step's `output` and a failed step's `error`, so whoever held the webhook's URL received what the run's steps had read. A call answered on 0.29:

  ```json
  {
    "success": true,
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "output": { "name": "Ada Lovelace" }
  }
  ```

  is answered on 0.30:

  ```json
  { "id": "550e8400-e29b-41d4-a716-446655440000", "status": "completed" }
  ```

  A run whose step failed is still answered `500`, with the same two keys. If a caller of yours reads `success`, `output` or `error`, end the automation with a `webhook/response` action that returns what it needs; its templates see every earlier step:

  ```yaml
  automations:
    - name: lookup-contact
      trigger: { type: webhook, method: POST }
      actions:
        - name: lookup
          type: record
          operator: read
          props: { table: contacts, id: '{{trigger.data.contactId}}' }
        - name: answer
          type: webhook
          operator: response
          props:
            status: 200
            body: { found: true, name: '{{steps.lookup.record.name}}' }
  ```

  `trigger.response` cannot do this: its `body` and `headers` templates see `{{run.id}}` and `{{trigger.data.*}}` only, and a `{{steps.*}}` path there renders empty. The manual trigger's answer is unchanged. See [Webhook & Cron Triggers](/en/docs/trigger-webhook-cron).

- **An automation's `read` and `list` steps hand over the record as the records API returns it**: camelCase `createdBy`, `updatedBy`, `createdAt` and `updatedAt` instead of the snake_case keys, no `deleted_at`, string ids. A step template reading the old keys must rename them; see Record Actions.
- **`$env.NAME` is resolved only in the configuration you wrote, never in data or in text built while the run goes.** An app that stored `$env.NAME` in data — a record field, a webhook body, a step output — and relied on a later step resolving it now gets the literal text, and so does a `code` action that builds a `$env.NAME` string and passes it to `context.actions`. Read the variable from `context.env` in a `code` action and pass its value. See [Environment Variables](/en/docs/automation-env-vars) and [Code Actions](/en/docs/automation-code-actions).
- **`data`, `filter`, `flow`, `digest`, `state` `filterNew`, the file actions, `record` batch writes and `ai` transcription now resolve the `$env.NAME` references in their properties**, like every other action. A property that relied on keeping the literal text `$env.NAME` must take it from data instead — a trigger field or a step's output — as there is no way to write it literally. See [Environment Variables](/en/docs/automation-env-vars).
- **Inside `{{…}}`, a bare `$env.NAME` is now a value, never text spliced into the expression.** A reference written into a dotted path, such as `{{trigger.data.$env.FIELD}}`, used to read the field the variable named and now renders empty; write `{{lookup trigger.data $env.FIELD}}`. A reference given to a helper, such as `{{uppercase $env.NAME}}`, or written alone, as `{{$env.NAME}}`, used to render empty and now renders the value.
- **Values are no longer rendered as templates a second time.** What a `code` action passes to `context.actions`, what a loop or a path branch fills into its actions, the `vars` given to a reusable template and the arguments of an MCP action tool are used as given: `{{…}}` and `$env.` text in them is kept as those characters. Code that relied on passing template text must render it before passing it. An env value containing `{{` or `}}` is likewise used as stored. See [Flow Control Actions](/en/docs/automation-flow-control) and [Reusable Actions](/en/docs/reusable-actions).
- **An MCP action tool whose template is a `code` action no longer fills its arguments into the code's source.** A `{{name}}` written in `code` now stays those characters; read the argument from `inputData` instead (`inputData: { name: '{{name}}' }`, then `context.inputData.name`). See [Reusable Actions](/en/docs/reusable-actions).
- **A `regex` or `matchAll` pattern taken from data is refused.** A pattern that reaches the helper from a trigger field, a step output, a variable or a subexpression is no longer compiled: the expression is kept as its own source text, as an unknown helper is. Write the pattern as a quoted string in the configuration — `{{regex trigger.data.ref "INV-(\d+)"}}`. See [Automations Overview](/en/docs/automations-overview).
- **An automation run is read, replayed and cancelled only** by an admin, by the person who started it by hand, or by an approver a request on that run names. Anyone else signed in gets `404`, a caller with no session `401`, and the run lists count only the runs the caller may read. A named approver sees a step's output only while what that step could read stays within her own reach: from the first step beyond it, every step's `output` reads `null` and carries no `logs`, while names, statuses, timings and errors stay. An approver of a run started on its own sees a record step's output only when it holds no related value her role may not read and, record by record, every record it holds, names or looks up through, at every hop, is one her row-level rules admit. An approver of a run started on its own no longer sees the triggering record's data when it carries values she may not read: the `triggerData` of a run a record or a comment started then reads `null`. See [Automation Runs](/en/docs/automation-runs).
- **A replay never runs past a filter or an approval** the original stopped at: it runs only the steps a failure left skipped. Replaying with new `triggerData` is admin-only; anyone else gets `403`.
- **Cancelling a run that already ended** — failed, rejected, stopped by a filter or timed out — answers `409`, as a completed or cancelled run already did.
- **Runs started by a call or a failure handler now record which run fed them**; an approver who does not read every run sees what such a run was handed only when she may read what the feeding run had read. Call and failure runs recorded before the upgrade are withheld from such approvers; their status, steps and timings stay visible. Step errors and request messages are now withheld wherever the step's output would be. A nullable `relay` column is added to the runs table on both engines; 0.29.x ignores it on rollback.

### Accounts and real-time

- An API key whose owner's ban has reached its end date works again on the records API and at `/mcp`, as the hosted forms already admitted her; a running ban still refuses the key with 401.
- **Users can delete their account at once**, by a mailed confirmation link, on any app with email configured. `auth.immediateAccountDeletion: false` turns it off; see GDPR & Privacy.
- **The `accountDeletion` email template is now the confirmation request** and must carry `$url`; see Email Templates.
- **Real-time subscriptions close** when the subscriber's access changes (close code `4001`, reconnect) and when their session ends (close code `4401`, sign in again — do not reconnect); see Real-Time Subscriptions.
- **Presence is served only on a page that declares it and whose access admits the caller**, and on a page showing one record only when she may read that record. The indicator now follows the real address (`/orders/42`, not `/orders/:id`), so people on different records no longer see each other.
- **Presence streams are capped at ten per user**, apart from the ten record subscriptions; an eleventh answers `429` with a `Retry-After` header. A stream ends when the access it was opened on ends — a change to the viewer's role, groups or assignments, a ban, the end of her session, or a write that moves the record out of her read rule — and the others on the page receive her `leave`.
- **The activity feed shows a reader only what the records API would**, for every role, viewer included: list and single entry leave out tables and rows she may not read, a single entry's `changes` keeps only her readable fields, and another user's email never reaches a non-admin. An admin reads every agent decision; anyone else reads her own decisions and those made on a run she started, and an agent action only when she could read its record. See [Activity Monitoring](/en/docs/activity-monitoring).
- **The first start of 0.30.0 scrubs, once, every automation run recorded before the upgrade that read stored records**: trigger data, step inputs, outputs, errors, logs and run errors are emptied; steps, statuses and timings are kept; each run is marked "values erased". A run still queued, running or waiting for an approval is left whole, so it resumes as before, and is scrubbed at the first start after it ends. This cannot be undone — export any run history you must keep before upgrading. From then on runs record which records they read, and erasing an account scrubs exactly the runs that read her records. Adds the `automation_run_refs` table and a `values_erased_at` column; a rollback keeps the scrubbed values empty.

### AI

- **AI chat answers and changes only what the records API would for the same user.** A list, count, total or average, and a table a tool looks up, read the tables she may read with her roles, groups and assignment roles, only the rows her row-level read rule shows her, and no row in the trash. A create, update or delete admits her assignment roles as the API does, and each record an update or delete reaches is checked against the table's `read`, `write` and `delete` rules. The confirmation counts only the records the operation may reach. See [AI Chat](/en/docs/ai-chat).
- **AI chat's tools no longer read a lookup, rollup, count or formula its user may not read, and no longer accept one as a filter.**
- **A delete through AI chat moves records to the trash**, as the records API's delete does, so they can be restored; it used to remove them for good.
- **A knowledge search (`POST /api/ai/rag/search`) returns a table's record only when the user may read that row**: the table permission over her role, groups and assignment roles, then the row-level read rule, whichever agent's knowledge base is searched. A record moved to the trash leaves the index and is never returned. See [AI RAG](/en/docs/ai-rag).
- **A knowledge search returns a chunk only when the user may read every field it holds.** Table knowledge is now embedded in separate chunks per group of fields that share a read permission, and a chunk naming a field she may not read is dropped from her results; narrowing a field's `read` takes effect from the next search. Chunks embedded by an earlier version name no fields and are never returned. Nothing to do on PostgreSQL: the first boot after the upgrade re-embeds every agent's table knowledge once the server is listening, and until it finishes a search may return fewer table results. `POST /api/ai/rag/rebuild` re-embeds on demand.
- **A declared agent answers each caller within that caller's own reach.** Its record tools read the intersection of the agent's reach and the signed-in caller's — the rows both row-level rules admit, the fields both may read — so an admin-role agent opened to members answers each member with what she may read. A signed-out visitor of an agent open to everyone gets what the records API serves a signed-out request; a scheduled run keeps the agent's declared reach. See [Agents Overview](/en/docs/ai-agents).
- **An automation's agent step (`type: ai`, `operator: agent`) retrieves from its own agent's knowledge base and the shared knowledge documents only**, never from another agent's index. In a run someone started by hand, it grounds only on the records and fields that person may read; a run started by a webhook, a schedule or a record event keeps the agent's declared reach. See [AI Actions](/en/docs/automation-ai-actions).

### SQLite

- **On SQLite, the default database, a write that takes several statements is now all-or-nothing.** A batch create, update, upsert, delete or restore, a record write together with its many-to-many links, a form submission and an account erasure either complete or leave nothing behind. A batch whose last record failed used to answer with the right error and keep every record written before it. While such a write is in progress, every other statement the server runs on the database — reads included — waits for it to finish, so a large batch briefly holds up the requests that arrive during it.
- **On SQLite, the default database, a row-level rule on a checkbox is now judged as the records API reads it.** SQLite stores a checkbox as `1` or `0`, and every gate that judged one stored record against a rule compared that with `true` or `false`: update and delete, the delete form and the batch routes, presence and real-time events, the activity feed, record history and comments, pages and form choices, the MCP tools and automation record actions. So a rule such as `locked neq true` let a member update, delete or watch a row the same rule hid from her list, and `draft eq true` refused her a row it opened. On 0.30 the rows such a rule hides are no longer editable, deletable or visible to her by any road, and a real-time update's `oldRecord` carries a checkbox as `true` or `false`.
- **A field named after a SQL keyword**, such as `values` or `window`, now starts on both databases. On SQLite, a table whose stored CHECK rules an earlier version wrote differently may be rebuilt once, rows kept, on the first start after the upgrade; see Validation.
- **On SQLite, a new single-select option is accepted** after an edit that also adds or renames a field on the same table. A database an earlier version left with the old option list is repaired on its first start after the upgrade — one rebuild that keeps the rows, with no config change; see Migrating a Database.

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
