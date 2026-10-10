# Grouping and Saved Views

> Three ways to get more out of one list request — summarise it, reuse a stored configuration, and reach rows that have been deleted.

## Grouping and aggregation

`groupBy` partitions records by a field's value; `aggregate` computes summary functions over them. Together they produce roll-ups such as total amount per status.

```
GET /api/tables/orders/records?groupBy=region,status&aggregate=amount:sum
```

`groupBy` takes a comma-separated list of fields, outermost first; three nesting levels is what it was designed around, and a blank entry is dropped so a trailing comma degrades to the levels actually named. Every field must exist and be readable by the caller — a level naming an unreadable field answers `404`, because a group header would otherwise report that field's distinct values to someone not allowed to see them, and a level naming a field the table does not have answers that same `404`.

Each `aggregate` entry is **`field:function`**, in that order. The functions are `sum`, `count`, `avg`, `min` and `max`. `sum` and `avg` take numbers; naming a field of any other kind is refused with `400`, naming the field. `min` and `max` take a number or a date: a `date` or `datetime` field — or a lookup of one — answers the earliest or latest as an ISO string, the day alone for a `date` (`2026-10-02`) and the full timestamp for a `datetime`. Any other field answers `400`, naming it; a lookup through a link to many records joins its values into text, so it is refused too — a `rollup` aggregates across linked records. An aggregate naming a field the table does not have answers the `404` an aggregate over a field the caller may not read gets, whatever its function, so the two cannot be told apart.

A `min`, `max`, `sum` or `avg` over no values answers `null`, never `0`. That covers a column no row fills, such as `deleted_at` on the live list, and a filter that finds no row. A `count` of no rows answers `0`.

**Getting the order backwards fails silently.** `?aggregate=sum:amount` parses as the field `sum` with the function `amount`, which is not a known function, so the entry is discarded. If every entry is discarded the parameter becomes absent and the request answers `200` with no aggregation at all — and nothing in the response says so. A JSON form is also accepted: `?aggregate={"count":true,"sum":["amount"]}`.

Without `aggregate`, `groupBy` returns `groups` as `{ name, path, count }`. With it, each group additionally carries `aggregations`, **and the whole-result-set `aggregations` still sits at the top level** — so one request answers "per group" and "overall" together instead of forcing a choice.

```json
{
  "groups": [
    { "name": "EMEA", "path": ["EMEA"], "count": 42 },
    { "name": "shipped", "path": ["EMEA", "shipped"], "count": 30 },
    { "name": "pending", "path": ["EMEA", "pending"], "count": 12 }
  ],
  "aggregations": { "sum": { "amount": 7400 } }
}
```

`path` holds the group's value at every level, outermost first, ending in its own `name`. It exists because a group's own value stops identifying it the moment `groupBy` names more than one field: two regions can each hold a `shipped` group, and a count carrying only `name` cannot say which one it describes.

**`groups` is a flat array ordered by depth, not a tree** — every level-1 group first, then every level-2 group. To build a tree, bucket the entries by `path.length` and match each to its parent on `path.slice(0, -1)`. A single-field `groupBy` returns single-entry paths, so a reader that keys on `name` alone keeps working.

The figures reconcile down the levels: the level-2 groups of one parent sum to that parent, and the level-1 groups sum to the top-level total. Every count and every aggregation describes the whole filtered result set rather than the page returned beside it, so the figures do not move as you page through the same query, and a group whose rows all fall on a later page still appears.

Groups are listed in the order the request's sort first meets them: with no `sort`, the group of the oldest record comes first.

**What a grouped listing costs.** The page is read with the same `limit` and `offset` as an ungrouped listing, the total with one count, and the groups with one grouped query per level, all in the database. A grouped page over five thousand rows reads the same page of rows as one over fifty, plus one row per group — the cost grows with the number of distinct values, not with the table. Grouping by a field whose values are nearly all different still returns one group per value, so keep `groupBy` to fields with a handful of values.

## The aggregate read

When you need figures and not rows — a dashboard card, a chart — ask the table's aggregate read. It answers over every record the filter matches, computed by the database, and never returns records.

```
GET /api/tables/deals/aggregate?groupBy=source&aggregate=value:sum
```

<!-- sovrium:options aggregateRecordsQuerySchema -->

`filter` and `aggregate` take exactly the grammar of the records list, so a binding moves from one to the other unchanged. `aggregate` also takes five percentiles, which only this read computes: `p50` (the median), `p75`, `p90`, `p95` and `p99`, as in `duration_ms:p95` or `{"p95":["duration_ms"]}`. A percentile takes a number field, like `sum` and `avg`, and is interpolated between the two values around its rank — over the durations 1 to 100 the `p95` is 95.05 — identically on SQLite and PostgreSQL; empty values are not ranked, and over none the answer is `null`. Each comes back under its own key, `aggregations.p95`, flat for one field and per field for several, in every group too. An entry naming another percentile — `p97` — answers `400` listing the five, where an unknown function is otherwise discarded. `q` takes the records list's search term too, matched the same way and combined with `filter`, so a figure bound to a search box narrows to the records the box matches. `aggregations` is always present and always carries `count`; with no `aggregate` it carries `count` alone. With `groupBy` the answer also lists `groups`, one per value of that field, each with its own `count` and figures, in the shape the records list uses; a group's `name` is the value as the records API reads it, and an empty value groups as `''`. `interval` buckets a `date` or `datetime` field by calendar — `day`, `week` (starting on Monday), `month`, `quarter` or `year` — and names each group by the bucket's first day as an ISO date (`2026-01-01`); on any other field it answers `400`. A `datetime` field also buckets by `hour` or `minute`, each group named by the bucket's first instant (`2026-10-09T14:00:00.000Z`); on a `date` field they answer `400`. Every bucket is UTC, and a bucket holding no record is not listed. Groups are listed in ascending order of their value. `numerator` and `denominator`, sent together, ask for a ratio: each is a filter expression in the same grammar, added to `filter`, and the answer gains `ratio: { numerator, denominator, percent }` — the two counts, computed by the same read, and `numerator ÷ denominator × 100`, which is `null` when nothing matches the denominator. One without the other answers `400`.

```json
{
  "aggregations": { "count": 250, "sum": 1375000 },
  "groups": [
    {
      "name": "Inbound",
      "path": ["Inbound"],
      "count": 100,
      "aggregations": { "count": 100, "sum": 600000 }
    },
    {
      "name": "Outbound",
      "path": ["Outbound"],
      "count": 100,
      "aggregations": { "count": 100, "sum": 500000 }
    },
    {
      "name": "Partner referral",
      "path": ["Partner referral"],
      "count": 50,
      "aggregations": { "count": 50, "sum": 275000 }
    }
  ]
}
```

<!-- sovrium:options aggregateRecordsResponseSchema -->

Every field the read names — in `aggregate`, in `groupBy` or in `filter` — is checked as on the records list: a field the caller may not read, or one the table does not have, answers `404`, so the two cannot be told apart. A grouping that would produce more than 500 groups answers `400` rather than a partial answer: group by a field with fewer values, or narrow the filter — a `minute` series covers at most 500 minutes, so filter it to a window such as `$now-6h`. The read costs the same database work over fifty records as over fifty thousand: one row for the totals and one per group. It counts against the same per-minute read budget as the records list, which is why a dashboard card asks it once rather than reading a page of records.

## Saved views

A view bundles a filter tree and a sort order under a stable id, so a recurring query is one parameter rather than a re-encoded expression on every request.

```
GET /api/tables/tasks/records?view=2
```

`?view=` matches on either the view's id or its name. A value matching neither — or any view reference against a table declaring no views — answers `404`, and so does a view the caller may not open: a view that declares a grant is opened on that grant, one that declares none on the table's read, exactly as on the view's own records route.

```yaml
tables:
  - id: 1
    name: tasks
    views:
      - id: 2
        name: Active Tasks
        filters:
          and:
            - field: status
              operator: in
              value: [todo, in_progress]
        sorts:
          - field: priority
            direction: desc
```

Explicit parameters interact with the view differently depending on which one they are:

| Parameter | Behaviour                                                                 |
| --------- | ------------------------------------------------------------------------- |
| `filter`  | **Merged** with the view's filter using `and` — a request can only narrow |
| `sort`    | **Replaces** the view's sort entirely when present                        |
| `fields`  | The view's field configuration is **ignored** on this endpoint            |
| `groupBy` | The view's grouping is **ignored** on this endpoint                       |

**`?view=` applies filters and sorts only.** A view's `fields` and `groupBy` are honoured by the dedicated view endpoint, `GET /api/tables/:tableId/views/:viewId/records`, not by the records list. Call that endpoint when the whole view should apply — it is the one every page component bound to the view reads. It applies the view's `groupBy` itself, every level of it: the answer carries `groups` exactly as the records list does for a `groupBy` of the same fields, and a `groupBy` parameter on the request is ignored — the view owns its grouping. It also accepts `aggregate`, and answers `aggregations` computed over the rows the view returns — the totals of a summary row on a grid bound to the view, and, when the view groups, the same totals per group; an aggregate on a column the view does not list is refused.

`GET /api/tables/:t/views/:v/records` accepts `page`, `limit`, `sort`, `q`, `aggregate` and a `filter` that only narrows the view's own (a reader's transient narrowing — the view's own conditions always apply); `fields` is intersected with the view's list. It needs no session when the view is public. The view is named by its id or its name, the answer carries the same `pagination` envelope as the records list, deleted rows are never included whatever `deleted` or `includeDeleted` say, and a `filter`, `sort` or search on a column the view does not list is refused or skipped rather than answered.

A view definition, read from `GET /api/tables/:t/views`, `GET /api/tables/:t/views/:v` or the `views` of `GET /api/tables/:t`, lists only the fields, filter conditions, sorts and grouping the caller may read; a view whose filter or sort rests on fields hidden from the caller is still listed, without those entries. Its own filter still decides which records it serves, and those records are masked as the records API masks them.

## Reaching deleted rows

Soft-deleted rows are excluded by default. Two parameters reach them:

| Parameter              | Result                                     |
| ---------------------- | ------------------------------------------ |
| `?includeDeleted=true` | Active **and** deleted rows in one listing |
| `?deleted=true`        | Deleted rows only — a trash listing        |

`includeDeleted` is compared against the exact string `true`. Any other value is read as "exclude deleted", so a near-miss narrows nothing and reports nothing. A trash-only listing is `?deleted=true`, or the dedicated `GET /api/tables/:tableId/trash`.
