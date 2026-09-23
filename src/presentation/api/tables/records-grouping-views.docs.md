# Grouping and Saved Views

> Three ways to get more out of one list request — summarise it, reuse a stored configuration, and reach rows that have been deleted.

## Grouping and aggregation

`groupBy` partitions records by a field's value; `aggregate` computes summary functions over them. Together they produce roll-ups such as total amount per status.

```
GET /api/tables/orders/records?groupBy=region,status&aggregate=amount:sum
```

`groupBy` takes a comma-separated list of fields, outermost first; three nesting levels is what it was designed around, and a blank entry is dropped so a trailing comma degrades to the levels actually named. Every field must exist and be readable by the caller — a level naming an unreadable field answers `404`, because a group header would otherwise report that field's distinct values to someone not allowed to see them.

Each `aggregate` entry is **`field:function`**, in that order. The functions are `sum`, `count`, `avg`, `min` and `max`.

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

## Saved views

A view bundles a filter tree and a sort order under a stable id, so a recurring query is one parameter rather than a re-encoded expression on every request.

```
GET /api/tables/tasks/records?view=2
```

`?view=` matches on either the view's id or its name. A value matching neither — or any view reference against a table declaring no views — answers `404`.

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

**`?view=` applies filters and sorts only.** A view's `fields` and `groupBy` are honoured by the dedicated view endpoint, `GET /api/tables/:tableId/views/:viewId/records`, not by the records list. Call that endpoint when the whole view configuration should apply.

## Reaching deleted rows

Soft-deleted rows are excluded by default. Two parameters reach them:

| Parameter              | Result                                     |
| ---------------------- | ------------------------------------------ |
| `?includeDeleted=true` | Active **and** deleted rows in one listing |
| `?deleted=true`        | Deleted rows only — a trash listing        |

`includeDeleted` is compared against the exact string `true`. Any other value is read as "exclude deleted", so a near-miss narrows nothing and reports nothing. A trash-only listing is `?deleted=true`, or the dedicated `GET /api/tables/:tableId/trash`.
