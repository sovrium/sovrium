# Views

> Saved ways of looking at a table — declarative filters, sorts, grouping and column selection, or a raw SQL query.

A view is a named, saved configuration of how a table's records are filtered, sorted, grouped and projected. Views live under a table's `views` array, and both the records API and the operator console can be asked for one by name.

A view works in one of two modes. **Config mode** declares `filters`, `sorts`, `fields` and `groupBy`. **SQL mode** supplies a raw `query` instead, and the config-mode properties are then unused.

## View properties

<!-- sovrium:options ViewSchema depth=1 -->

## Config mode

Filter, sort, group and choose columns without writing SQL.

```yaml
views:
  - id: active_high_priority
    name: Active — High Priority
    isDefault: true
    filters:
      and:
        - { field: status, operator: equals, value: active }
        - { field: priority, operator: equals, value: high }
    sorts:
      - { field: created_at, direction: desc }
    fields: [title, status, priority, assigned_to]
    groupBy: { field: status, direction: asc }
```

### Filters

A filter is either one condition or a boolean group combining conditions with `and` or `or`, and the groups nest.

<!-- sovrium:options ViewFilterConditionSchema -->

```yaml
filters:
  or:
    - { field: priority, operator: equals, value: high }
    - { field: priority, operator: equals, value: urgent }
```

### Sorting and grouping

<!-- sovrium:options ViewSortSchema -->

<!-- sovrium:options ViewGroupBySchema -->

`sorts` is an ordered list, so a second entry breaks the ties the first leaves. `groupBy` takes one field; its `direction` orders the groups themselves rather than the rows inside them.

## SQL mode

For reporting a declarative filter cannot express, supply a raw `query`. `materialized: true` caches the result as a materialized view, and `refreshOnMigration: true` refreshes that cache whenever migrations run.

```yaml
views:
  - id: monthly_revenue
    name: Monthly Revenue
    query: >
      SELECT date_trunc('month', created_at) AS month, SUM(amount) AS revenue
      FROM orders GROUP BY 1 ORDER BY 1
    materialized: true
    refreshOnMigration: true
```

A materialized view is a cache, and a cache has an age. `refreshOnMigration` ties its refresh to a moment that already exists rather than inventing a schedule, which is why there is no interval to configure.

**`materialized` is a PostgreSQL feature, and on SQLite it degrades rather than failing.** SQLite has no materialized-view object at all, so the view is created as a plain one and the refresh becomes a no-op — there is nothing to refresh when the view is always live. The declaration is accepted on both engines and the reads are observationally the same; what you lose on SQLite is the caching, not the view. Note too that the example's `date_trunc` is Postgres-only SQL: a raw `query` is passed to the database as you wrote it, so a view meant to run on both engines has to be written in SQL both of them accept.

## Exactly one default

Marking a view `isDefault: true` decides what a consumer gets when it asks for the table without naming a view. The single-default rule and the uniqueness of view ids are both checked when the configuration is decoded, so two defaults stop the boot rather than making the answer depend on array order.

## Who may see a view

<!-- sovrium:options ViewPermissionsSchema -->

A view's permissions narrow what the table already allows; they never widen it. A role that cannot read the table cannot reach a view of it.
