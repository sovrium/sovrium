# Filtering, Sorting and Pagination

> The query grammar of the list endpoint — every parameter it reads, the three that behave unlike their neighbours, and the two mistakes that return a wrong answer instead of an error.

`GET /api/tables/:tableId/records` always answers with the list envelope, never a bare array. Every parameter below is optional and they combine freely.

```
GET /api/tables/tasks/records?limit=10&sort=priority:desc,name:asc&fields=id,name,status
```

## Every parameter the list reads

<!-- sovrium:options listRecordsQuerySchema -->

**`order` is accepted and never read.** It is part of the published query schema, so a client sending `?order=desc` gets a `200` and ascending rows. Direction belongs inside `sort`, as `sort=field:desc`.

## Paging

Paging is `limit` plus `offset`, with `page` as a 1-based alias.

```
GET /api/tables/tasks/records?limit=20&offset=40   # rows 41–60
GET /api/tables/tasks/records?limit=20&page=3      # the same rows
```

`page` resolves to `offset = (page - 1) * limit` and applies **only when the request sends no `offset`**, so adding `page` to a request that already works cannot change which rows it returns. A `page` that is not a positive number is ignored and the request falls back to the first page.

`limit` is an integer from `1` to `100`; `offset` is `0` or greater. Anything else — `?limit=0`, `?limit=500`, `?limit=abc`, `?offset=-5` — is refused with `400`, naming the parameter and the range it accepts.

The same ceiling holds in configuration. A page component naming a larger page size is refused at validate, so a grid offering `200 / page` never reaches a reader who could pick it.

Nothing is clamped, deliberately. Serving 100 rows to a request that asked for 500 is a silent wrong answer: a client walking the table with `offset += limit` would skip 400 rows per step and never be told. And `?limit=0` carries no intent to clamp toward. This is where `limit` parts company with `page`, which is ignored rather than refused — an unusable `page` names no window at all, while an out-of-range `limit` names one the envelope cannot describe. The range check runs _after_ the read gate, so a caller who may not read the table still receives the anti-enumeration `404` rather than a `400` that would confirm the table exists.

`total` counts every matching row independently of the page, and the envelope derives `totalPages`, `hasNextPage` and `hasPreviousPage` from it. Both `limit` and `offset` are applied by the database, so page 40 of a large table costs what one page costs. Adding `groupBy` is the exception: a group spans the whole result set, so that request reads every matching row before grouping.

## Revalidating a list

Every list answer carries an `ETag`, taken over the exact rows and fields **you** receive, and `Cache-Control: private, no-cache`. Send the tag back in `If-None-Match` and an unchanged list is `304 Not Modified` with no body; a write to any row in it, or a change to what you may read, gives a new tag and a full `200`. Browsers revalidate on their own, so a page that re-reads the same list on every visit downloads it only when it has changed. The same holds for a view's records (`GET /api/tables/:tableId/views/:viewId/records`).

A tag is never shared across permissions: a caller replaying a tag another role received gets their own `200`, not a `304`. Nothing is marked `public` and there is no `max-age`, so a read that follows a write always sees it.

## Sorting

Comma-separated `field:direction` segments, leftmost first.

```
GET /api/tables/tasks/records?sort=priority:desc,name:asc
```

A segment sorts ascending unless its direction is exactly `desc`. A single-select field sorts by its declared option order rather than alphabetically, so `low` / `medium` / `high` orders the way it was authored instead of the way it spells.

A record with no value in the sorted field comes last, ascending and descending.

A caller may sort by exactly the fields they may read — a field read grant, one naming a group they belong to, or the built-in role defaults when the table declares no field rules — and by the system fields. A sort on a field the caller may not read is answered with the same `404` as a filter on it, never with rows ordered by the hidden value — and so is a sort on a field the table does not have, so the two cannot be told apart.

## Choosing columns

```
GET /api/tables/contacts/records?fields=id,name,status
```

`fields` is a projection: only the named columns are read from the database, so a narrow selection over a wide table is cheaper in the query as well as on the wire. Each record still carries `id`, `createdAt` and `updatedAt` at its root alongside the authorship keys — narrowing the list never drops the metadata beside it. Those three system names are accepted inside the list and served from the record root. A name matching neither them nor a field of the table selects nothing, as a field the caller may not read selects nothing — a misspelt name is never reported, so check a selection against the records it returns.

A many-to-many field is returned only when the list names it. Fields the caller may not read are omitted whether or not the list names them — omitted from an ordinary `200`, never turned into an error.

## Relationship labels

A relationship field stores the key of the linked record. When the field declares a `displayField`, each record also carries the label of that record under `_display`, beside the key:

```
{ "id": "7", "fields": { "channel": 30 }, "_display": { "channel": "Zoom" } }
```

`?labels=<field>:<relatedField>[,…]` adds, under `_display`, the label of a relationship column from a field of the related table. The stored key is unchanged. A pair naming a field that is not a relationship, or a column the related table lacks, is ignored. A label is returned only if the caller may read that field.

The same rule applies to a declared `displayField`: a label comes from another table, so it is left out for a caller who may not read that field there, and the key stands on its own. A requested pair replaces the declared label of the same field for that response.

A `user`, `created-by`, `updated-by` or `deleted-by` field stores an account id; `_display` carries the account's name for it, or its email when the account has no name. An id that names no account keeps showing the id. The single-record read carries the same `_display` block as a list row.

## Filtering

The shortcut is a single equality:

```
GET /api/tables/tasks/records?filter=status:active
```

On a checkbox field the shorthand reads `true`/`false` (and `1`/`0`) as the boolean they name, on both engines.

Anything richer is a JSON tree whose top level is an `and` array of `{ field, operator, value }` conditions:

```
GET /api/tables/tasks/records?filter={"and":[{"field":"status","operator":"in","value":["todo","in_progress"]}]}
```

**`?filter` is an `and` list.** A flat object (`{"status":"active"}`), a lone condition, a bare array or a top-level `or` is refused with a `400` naming the `and` list the API takes. Use the shortcut or the `and` tree.

The operators are `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `contains`, `startsWith`, `endsWith`, `isNull`, `isNotNull`, `isEmpty`, `isNotEmpty`, `isTrue`, `isFalse`, `in` and `notIn`. `isEmpty` keeps the rows whose field is NULL, empty text, an empty list or an empty object, `isNotEmpty` the others, on any column type; neither takes a `value`. `isTrue` and `isFalse` take a checkbox, a formula whose `resultType` is `boolean`, or a lookup of a checkbox; on any other field they are refused with a `400` naming the field.

A filter naming a field the caller may not read, or a field the table does not have, is answered with the same `404`, so the two cannot be told apart.

`notIn` takes a list and keeps the records whose value is none of the listed values. A record with no value is kept by neither `in` nor `notIn`. `notIn` over an empty list leaves out nothing that has a value. A single value counts as a list of one, and a `null` in the list matches nothing.

An operator outside that set is refused with a `400` naming it and listing the supported ones, so a misspelt `greaterThanOrEqualTo` is an error rather than a different filter.

`contains`, `startsWith` and `endsWith` ignore case, identically on SQLite and PostgreSQL, and treat their value as literal text: a `%` or `_` in the term is a character being searched for, not a wildcard. Every other operator compares exactly as given, so `equals` is case-sensitive.

`filterByFormula` is an alternative syntax accepting an `AND(…)` wrapper over `{field}` references compared with `=`, `!=`, `<`, `<=`, `>` and `>=`.

A condition's `value` may be a relative date — `$today`, `$today+Nd`, `$today-Nd`, `$today+Nw`, `$today-Nw`, `$startOfMonth` or `$startOfNextMonth` — which the server resolves to the calendar day it names on the day of the request, before the filter reaches the database. A value that starts like one of these but is outside the list — `$today+1m`, `$startOfYear` — is refused with a `400` naming the value and the tokens that exist, rather than compared as text.

## Searching

```
GET /api/tables/contacts/records?q=zinc
```

`q` matches case-insensitively and runs in the query across the whole table, not over the page the caller happens to hold. Because it is applied as a filter, `total` reports the number of _matching_ rows, so the pager stops offering pages the narrowed result no longer has. `q` combines with `filter`: a record must satisfy both.

The term is matched against text-shaped fields only — single-line text, long text, rich text, email, URL, phone number, single-select, status, code and barcode. Numbers, dates and booleans are not searched, and computed fields are excluded because they are view expressions rather than stored columns.

Only fields the caller may read are searched, so a match can never disclose the content of a field hidden from that role. A table exposing no readable text field to the caller matches nothing, rather than matching everything.
