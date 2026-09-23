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

Nothing is clamped, deliberately. Serving 100 rows to a request that asked for 500 is a silent wrong answer: a client walking the table with `offset += limit` would skip 400 rows per step and never be told. And `?limit=0` carries no intent to clamp toward. This is where `limit` parts company with `page`, which is ignored rather than refused — an unusable `page` names no window at all, while an out-of-range `limit` names one the envelope cannot describe. The range check runs _after_ the read gate, so a caller who may not read the table still receives the anti-enumeration `404` rather than a `400` that would confirm the table exists.

`total` counts every matching row independently of the page, and the envelope derives `totalPages`, `hasNextPage` and `hasPreviousPage` from it. Both `limit` and `offset` are applied by the database, so page 40 of a large table costs what one page costs. Adding `groupBy` is the exception: a group spans the whole result set, so that request reads every matching row before grouping.

## Sorting

Comma-separated `field:direction` segments, leftmost first.

```
GET /api/tables/tasks/records?sort=priority:desc,name:asc
```

A segment sorts ascending unless its direction is exactly `desc`. A single-select field sorts by its declared option order rather than alphabetically, so `low` / `medium` / `high` orders the way it was authored instead of the way it spells.

## Choosing columns

```
GET /api/tables/contacts/records?fields=id,name,status
```

`fields` is a projection: only the named columns are read from the database, so a narrow selection over a wide table is cheaper in the query as well as on the wire. Each record still carries `id`, `createdAt` and `updatedAt` at its root alongside the authorship keys — narrowing the list never drops the metadata beside it. Those three system names are accepted inside the list and served from the record root. A name matching neither them nor a field of the table is refused with `400`, naming the offending field.

A many-to-many field is returned only when the list names it. Fields the caller may not read are omitted whether or not the list names them — omitted from an ordinary `200`, never turned into an error.

## Filtering

The shortcut is a single equality:

```
GET /api/tables/tasks/records?filter=status:active
```

Anything richer is a JSON tree whose top level is an `and` array of `{ field, operator, value }` conditions:

```
GET /api/tables/tasks/records?filter={"and":[{"field":"status","operator":"in","value":["todo","in_progress"]}]}
```

**A flat object does not filter.** `?filter={"status":"active"}` parses, passes every check, and returns **every row**, because the builder reads only the top-level `and` key. A top-level `or` is dropped the same way. Use the shortcut or the `and` tree.

The operators are `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `contains`, `startsWith`, `endsWith`, `isNull`, `isNotNull`, `isEmpty`, `isTrue`, `isFalse` and `in`.

An operator outside that set **falls back to equality silently** — no error, just wrong results — so a misspelt `greaterThanOrEqualTo` quietly becomes `=`.

`contains`, `startsWith` and `endsWith` ignore case, identically on SQLite and PostgreSQL, and treat their value as literal text: a `%` or `_` in the term is a character being searched for, not a wildcard. Every other operator compares exactly as given, so `equals` is case-sensitive.

`filterByFormula` is an alternative syntax accepting an `AND(…)` wrapper over `{field}` references compared with `=`, `!=`, `<`, `<=`, `>` and `>=`.

## Searching

```
GET /api/tables/contacts/records?q=zinc
```

`q` matches case-insensitively and runs in the query across the whole table, not over the page the caller happens to hold. Because it is applied as a filter, `total` reports the number of _matching_ rows, so the pager stops offering pages the narrowed result no longer has. `q` combines with `filter`: a record must satisfy both.

The term is matched against text-shaped fields only — single-line text, long text, rich text, email, URL, phone number, single-select, status, code and barcode. Numbers, dates and booleans are not searched, and computed fields are excluded because they are view expressions rather than stored columns.

Only fields the caller may read are searched, so a match can never disclose the content of a field hidden from that role. A table exposing no readable text field to the caller matches nothing, rather than matching everything.
