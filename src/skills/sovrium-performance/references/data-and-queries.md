# Data and queries

A page that lists records costs what its query costs, on every request: a page that reads table data is rendered fresh by design (`page-cache-and-rendering.md`). So the lever is the query — how many rows, filtered how, on which index. Manual: `sovrium docs pages/pages-data-binding`, `sovrium docs records/records-filtering-sorting`, `sovrium docs tables/table-indexes-constraints`, `sovrium docs tables/table-views`, `sovrium docs operations/database-infrastructure`.

## Contents

- [How many rows a binding reads](#how-many-rows-a-binding-reads)
- [Search](#search)
- [Refresh](#refresh)
- [Indexes](#indexes)
- [Views](#views)
- [The records API](#the-records-api)
- [The database](#the-database)

## How many rows a binding reads

| The binding declares              | It draws                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| No `pagination`, no `limit`       | Every record the visitor may read, on one page                    |
| `limit`                           | At most that many rows in all; no pager when they fit on one page |
| `pagination.pageSize` (+ `style`) | One page at a time: `numbered`, `loadMore` or `infinite`          |
| both                              | Pages of `pageSize`, counting no more than `limit` rows           |

```yaml
components:
  - type: table
    dataSource:
      table: products
      filter: [{ field: category, operator: eq, value: $query.category }]
      sort: [{ field: name, direction: asc }]
      pagination: { pageSize: 50, style: numbered }
```

- **A large table always paginates.** There is deliberately no "draw no control" style: to show everything, omit `pagination` — which on a large table is exactly the slow page.
- `pageSize` is capped at the records API's page ceiling; the data-binding article states it.
- A container repeating its children per row is drawn on the server, once per request, and draws at most `limit` rows — give it one.
- A component bound to a cursor-paginated system endpoint offers a single load-more control and no total.

## Search

`mode: search` filters across `searchFields` as the visitor types, throttled by `debounceMs` and capped by `limit`. With `searchEngine: client`, the default, the bound rows travel to the browser and the filtering happens there — fine for a short list, wrong for a large table. Read `sovrium docs pages/pages-data-binding` for what each declared engine does in the binary you run; for a large table, cap the binding with a `limit` and let the visitor narrow it through a search box that publishes `q` to the records endpoint.

## Refresh

| `refreshMode`    | Cost                                               |
| ---------------- | -------------------------------------------------- |
| `none` (default) | Read once per page load                            |
| `poll`           | Re-read every `pollIntervalMs`, for every open tab |
| `realtime`       | One subscription per table per page, held open     |

Use `poll` or `realtime` only where a stale view hurts the visitor (a queue, a live board), never as a default.

## Indexes

Declared on the table, checked at config time:

```yaml
indexes:
  - { name: idx_products_category, fields: [category] }
  - { name: idx_products_category_price, fields: [category, price] }
  - { name: idx_products_active_slug, fields: [slug], unique: true, where: 'deleted_at IS NULL' }
```

- Index each field a page or a caller filters or sorts on in a table that grows. Without one the database reads every row to answer. [S14][S15]
- **Order is load-bearing**: an index on `[category, price]` serves a lookup on `category` alone and on both, never on `price` alone.
- A field's `unique: true` or the table's `unique` array already creates an index.
- `where` makes a partial index: smaller, and the way to keep a value unique among live rows only.
- Each index costs on every write; do not index what nothing filters on.
- Confirm on the database: PostgreSQL's `EXPLAIN` or SQLite's `EXPLAIN QUERY PLAN` on the query the slow request runs shows whether the index is used.

## Views

A table's `views` save a filter, sort, projection and grouping under a name; every data component can show one.

- **Config mode** (`filters`, `sorts`, `fields`, `groupBy`) narrows what is read; `fields` keeps unneeded columns out of the response.
- **SQL mode** (`query`) is stored as a database view. `materialized: true` stores its result instead of recomputing it on each read — fast, and stale until refreshed; `refreshOnMigration` recomputes it when a migration runs. Say so when you recommend it.
- A records request with `groupBy` reads every matching row before grouping; on a large table, group in a view instead.

## The records API

- Paging is `limit` plus `offset` (or `page`), applied by the database, so a deep page costs what one page costs. Out-of-range values answer `400`, never a silent clamp.
- `fields=` returns only the columns asked for.
- Responses carry an `ETag` scoped to the caller's permissions; a matching `If-None-Match` answers `304`.
- Range and parameters: `sovrium docs records/records-filtering-sorting`.

## The database

| `DATABASE_URL`     | Engine           | Reach for it when                                                                                                            |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| unset, or `file:…` | SQLite, embedded | One process, modest write concurrency, zero configuration                                                                    |
| `postgresql://…`   | PostgreSQL       | Many concurrent writers, large tables, and the features that need it — on SQLite those answer `501` with `requires-postgres` |

The engine is the operator's choice. Recommend a move only with a measurement that points at the database (slow queries under concurrent writes), and read `sovrium docs operations/database-infrastructure` first: data does not move between engines by itself.
