# Table Permissions

> Role-based access control for a table, per-field read and write audiences, row-level predicates — and why an unauthorized read answers 404.

Sovrium controls record access at three levels: **role-based access control** on the table, **field-level permissions** for individual columns, and optional **row-level predicates** for scoping within a role. Unauthorized access returns **404**, never 403, so that probing for status codes cannot be used to discover which records or tables exist.

## Permission values

Every operation accepts one of three shapes.

| Value                 | Meaning                                      |
| --------------------- | -------------------------------------------- |
| `all`                 | Everyone, including unauthenticated visitors |
| `authenticated`       | Any signed-in user                           |
| `['admin', 'editor']` | Only the listed role names                   |

The three built-in roles are `admin`, `member` and `viewer`, highest to lowest. A custom role name declared under `auth.roles` is accepted in the array form.

**A role the app does not declare grants nothing.** A signed-in user whose stored role is empty, unset, or a name the app does not declare (a typo, a role removed from `auth.roles` after it was assigned) is not treated as a `member`: she holds no role-based grant and no default. Every record operation on a table that does not open it to `all` or `authenticated` — list, single read, create, update, delete — answers her `404`, exactly as a missing record, and nothing is written. Groups she belongs to still grant what they name.

## Table-level permissions

<!-- sovrium:options TablePermissionsSchema -->

```yaml
permissions:
  read: all
  comment: authenticated
  create: [admin, editor]
  update: [admin, editor]
  delete: [admin]
```

**Writing to what a table holds requires reading it.** On a table whose `read` refuses the caller, an update of a stored record — by `PATCH`, the edit form, the batch route or bulk-update — a delete of one — by `DELETE`, the delete form, either batch delete route or bulk-delete — and an upsert answer exactly as a record or table that does not exist (`404`, the same body), and nothing is written or deleted; so does any request on the table whatever its shape, a malformed one included. A `create` grant still lets her file records there, and the answer hands back none of the record: `201` with `{ "created": 1 }` (or the count, from the batch route), no value and no id.

**The `viewer` role writes only where a table names it; grants reaching her through a group or an assignment are read-only.** A group she belongs to (`group:ops`) or a role an assignment gives her opens a table to her read, never to her writes: she is refused `create`, `update` and `delete` on every road a record is written by — the records API and its batch routes, restore, the delete form, a record button, the MCP tools, an automation she starts and AI chat — with the `404` a refused write always answers. A grant naming `viewer` itself, or `all` / `authenticated`, admits her on all of those roads alike: she creates, updates, deletes and upserts by batch exactly as she writes one record at a time. To let someone write through a group, give her a role that writes.

Declaring **any** operation turns the table into a gated one, and every operation left out is then denied to non-admins. A table with no `permissions` block at all — or one that sets only `fields`, `inherit` or `override` — declares no operation and stays open to every declared role except `viewer`. That asymmetry is deliberate: a half-written permissions block should fail closed.

`create: all` opens `POST /api/tables/<table>/records` to a visitor who is not signed in — the records-API twin of a public form. The row-level `create` rule, field write permissions and every value rule still apply, and anonymous creates are rate-limited like a form submission: 10 per visitor address and 1000 per table in any 60 seconds, after which the API answers `429` with a `Retry-After` header. A record a signed-out visitor creates is authored by the system; a `created-by` value the visitor sends is ignored. Anonymous creates are counted apart from every form. `read: all` opens the list and single-record reads the same way; `update`, `delete` and the batch routes always require a session. Whether a table is open to a signed-out visitor is decided on the grants it resolves to once `inherit` and `override` apply — the same grants a signed-in caller is judged on — so an `override` that narrows `read` or `create` to `authenticated` closes it to visitors (`401`, nothing written) whatever the table's own block says, and that holds for its comment thread too.

Pages follow the same rule. In an app with `auth`, a visitor who is not signed in sees a table's records on a server-rendered page — a list, a search, a single record, a board, a calendar, a `/feed.xml` item — only when the table's resolved `read` is `all`. A table with no `permissions` block, `read: authenticated` or a list of roles shows her none of its rows on any page, exactly as the records API answers her `401`; declare `read: all` on a table whose records a public page must show. An app with no `auth` block has no signed-in visitors and keeps every undeclared table open.

A grid bound to the table offers its create controls — the New record button, Import, and the add-row line — only to a caller the `create` grant admits, wherever the grid sits on the page. A caller it does not admit is shown none of them, rather than a control the server would refuse.

### Restore and permanent delete have no grant of their own

**Restore shares the `delete` grant.** Restoring is the inverse of soft-deleting, so both directions pass through one door: whoever may soft-delete a record may restore it. A separate grant would let the two drift apart, leaving one of them a weaker door onto the same operation. Under row-level rules, the `read` and `delete` rules are checked on the trashed row, on the single and the batch restore alike; a row they exclude answers `404` and stays in the trash.

**Permanent delete is admin-only and not configurable.** `?permanent=true` erases the row irreversibly, so it is reserved for the `admin` role on every table regardless of what `permissions` says. A non-admin attempt answers `404`, like any other unauthorized access.

## Field-level permissions

Each entry names a `field` and optionally its `read` and `write` audiences, in the same three shapes. An omitted audience inherits from the table — `read` from the table's `read`, `write` from `create` and `update`.

**A visitor who is not signed in never holds `authenticated`.** On a table she may read or create on (`read: all`, `create: all`), a field whose `read` is `authenticated` is left out of everything she receives — the list, a single record, and the record her own create hands back — while a signed-in reader sees it. A field whose `write` is `authenticated` is likewise not hers to set.

**A value the caller may not read is never theirs to change.** A field with no `write` rule is writable only by a caller who may read it, whether the read is kept from them by a `read` rule (a `group:` entry counting for its members) or by the built-in defaults below. A field the caller may not read is writable only when its `write` rule names their role — a suggestion box, `{ field: feedback, read: [admin], write: [member] }`, takes a member's note that only an admin reads back. The refusal is the one a `write` rule gives, on every road a record is written by: `404` on the records API (a single write, the edit form, a create, the batch and bulk routes, an upsert), invalid params (`-32602`) on the MCP create and update tools, and a refusal from an automation run started by hand, the record drawer and the AI chat. A `group:` entry in a `write` rule is matched against the caller's role only, so it admits nobody but an admin.

<!-- sovrium:options FieldPermissionSchema -->

```yaml
permissions:
  read: authenticated
  fields:
    - { field: salary, read: [admin, hr], write: [admin] }
    - { field: department, read: all, write: [admin] }
```

With no `fields` entries, built-in defaults apply: a `viewer` reads only a single-line-text field named `name` or `title`, and no email, phone or currency field; a `member` reads everything except a currency field named `salary`. These defaults reach every surface, the MCP tools included; declaring any `fields` entry replaces them.

A field a role cannot read is not **named** to that role either: the table definition from `GET /api/tables/<table>` lists only the fields the caller may read, and its primary key only when the caller may read that field. The same holds for `GET /api/tables/<table>/permissions`: its `fields` map has one entry for every field the caller may read, `{ read: true, write: … }`, where `write` is exactly what a write of that field would be allowed — `true` for a readable field with no `write` rule — and no entry for a field the caller may not read. Its `table` flags never report `create`, `update` or `delete` as `true` for an operation the records API would refuse that caller. When the caller may not read the table itself, the map answers `404` with the same body as a table that does not exist, so it discloses neither the table's fields nor that the table exists. A field missing from that map is therefore one the caller may not read; such a field is writable only through an explicit `write` grant naming the caller's role, and a kanban board grouped or laned on it offers no drag.

A field a role cannot read is also not **queryable** by that role: `filter`, `groupBy` and `aggregate` on it answer `404`. A hidden column would otherwise leak its values through the result set — `groupBy` returns its distinct values and `aggregate` its minimum and maximum, so hiding the column while leaving it queryable hides almost nothing.

The rule holds at any nesting depth, so a restricted field inside an `and` or `or` group is refused exactly like a top-level one, and it covers **CSV export**: `?filterField=` on an export request is checked against the same field-read permissions. Leaving export out would leak the column through which _rows_ come back, one answer per request, even though the column itself is absent from the file.

The same rule holds on pages. A field a role cannot read is never rendered into a page for that role — not in a `$record.*` substitution, not in a form's prefilled values — and a record-bound page for a row or table the role cannot read answers 404. Nor is the field named: no page carries its name, its label or its option values, whichever component draws it — not in what the component shows, and not in the configuration the page hands its scripts. A part of a component built on that field is left out for that reader (a colour, a card line, a column, a search field, a link built from it), and a component with nothing meaningful left to show is left out of the page. A signed-out visitor on a public page is held to the same rule, against the fields the table lets a visitor read. A page's own `access` does not widen this: a public page over a table whose `read` is `authenticated` shows a visitor who is not signed in none of its records.

## Row-level permissions

`rowLevelPermissions` scopes within a role rather than instead of it. Each operation may carry a server-side `when` predicate that is appended as a filter to every record-returning request; the permission gate runs first, and it counts the caller's role, any `user_access` roles and every `group:` membership alike; only then does the predicate narrow the rows the caller reaches.

That gate is the same one a table without row-level rules answers to, and `GET /api/tables/<table>/permissions` reports it. A row-level rule never opens an operation: one the `permissions` block leaves out is refused to non-admins as soon as the block names any operation, exactly as above, and a table that `inherit`s or `override`s its grants is judged on the grants they resolve to. A refusal answers `404`, the same as an operation granted to admins only.

The role a `user_access` assignment gives counts only on a table that declares `rowLevelPermissions`, where the rule then decides which rows it reaches. On a table with no row-level rule it opens nothing: a member whose `engineer` role comes only from an assignment is refused a table that grants `read` to `engineer` and declares no rule, on the records API, on every page that draws its records, and in a hosted form that names one of them.

<!-- sovrium:options RowLevelPredicateSchema -->

`field` may be a relation chain such as `project.client_id`, and `value` may be a literal or a reference resolved per request from the caller's session.

```yaml
rowLevelPermissions:
  read:
    when:
      field: client_id
      operator: in
      value: { kind: currentUser, path: { kind: assignment, tableSlug: clients } }
  write:
    when:
      field: client_id
      operator: in
      value: { kind: currentUser, path: { kind: assignment, tableSlug: clients } }
```

An update answers to the `read` rule as well as the `write` rule: a record the `read` rule hides from the caller is refused exactly as a missing record (`404`, nothing written), even where the `write` rule would admit it — on a single update, in a batch, as the match of an upsert, from the record drawer's save, and through the AI chat.

A `write` rule is checked twice: against the record as it stands, and against the record as the change would leave it. An editor scoped to one client can retitle that client's ticket but cannot reassign it to a client outside their scope; the attempt answers `404` and nothing is written, on the records API and on the MCP update tool alike.

The row as written is the one the write will actually leave: a value the role may not write never counts toward the check, and the same holds for the edit form's native save, a batch that names one record more than once (its entries applied in order), and a bulk update. An upsert answers to the same rules: each record it merges onto is checked as an update is, and each record it creates as a create is, so neither branch reaches a record the reader may not read or write.

A read rule also governs the links that point at its table. A many-to-many field lists only the linked records its reader may read — on a single record, on a list, in the record's `_display` labels and in an edit form's prefill — so a record another table keeps private is neither keyed nor named through it. A many-to-one field keeps the key it stores, since that value is the record's own, but the related record's name is left out of `_display` when the reader may not read it.

A read rule that names no `$currentUser` applies to a reader with no session as to anyone else, on the records API and on pages; only a rule naming the signed-in person needs one. A visitor who is not signed in never satisfies a rule that names the signed-in person — anywhere in it, even in one branch of an `or` — so on a table whose `read` is `all`, such a rule shows her no record: the list is empty and every single read answers `404`, as a missing record does.

A rule's `value` is compared with the field as it is stored, so it is written in the field's own type. The list, a single record, an update, a delete, a restore and the history then admit the same rows on SQLite and on PostgreSQL. `sovrium validate` and the startup refuse two shapes, saying what to write instead:

- **A rule on a multi-select field.** The field stores a list of options and a rule compares one value. Rule on a single-select, text or checkbox field instead.
- **A value whose type does not match the field.** A number field takes a number (`12.5`, not `'12.50'`), a date field a day written `YYYY-MM-DD` (`2026-10-01`), a date-and-time field the UTC instant as it is stored (`2026-10-01T09:30:00.000Z`), and a checkbox `true` or `false`, never their text.

A `$currentUser` value is resolved per request and is accepted on any field. It resolves to the same value on every door — the records API and its lists, pages, hosted forms, the MCP tools and real-time — and a rule naming a value the reader does not have (no email address on her account) matches no row. A rule on `$currentUser.email` therefore matches the reader's own address and never a record whose field is empty.

The one path a rule does not resolve is `activeAssignment`, the tenant switcher's active scope: `sovrium validate` and the boot refuse a rule that names it, in either form. Scope a rule with `assignment` (`$currentUser.assignments.<table>`) instead; the active scope narrows page data-source filters only.

An empty value satisfies no `eq`, `neq` or `in`. Under `status neq draft`, a record whose `status` is empty is left out of the list and answers `404` to a single read, an update, a delete and every other door, and the activity feed leaves out its entries. A `create` rule is judged on the record as it will be stored: a field the body leaves out counts with its `default`, and one with no default is empty, so `status neq draft` refuses a create that omits `status` unless the field has a default.

## Resource and action permissions

A broader permission context — the admin surface, an API key — is expressed as a map of resource to allowed actions, where `*` means every action.

```yaml
users: [read, list]
posts: [create, read, update, delete]
analytics: ['*']
```
