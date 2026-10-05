# Views

> Saved ways of looking at a table — declarative filters, sorts, grouping and column selection, or a raw SQL query.

A view is a named, saved configuration of how a table's records are filtered, sorted, grouped and projected. Views live under a table's `views` array, and both the records API and the operator console can be asked for one by name.

A view id may be any legal name, including a SQL keyword such as `all` or `order`. A view with a text id, or with a `query`, is stored as a database view under that id, so the id must differ from every table's name and from the views of every other table: `sovrium validate` refuses a clash and names it.

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

`isEmpty` and `isNotEmpty` take no `value` and follow the one rule every surface shares: a field is empty when it is NULL, an empty text, an empty list or an empty object — so a multi-select with nothing picked and a JSON field holding `{}` are empty, on PostgreSQL and SQLite alike. Nothing else is: `0`, `false`, a blank space, `{"a": null}` and `[null]` are values. The same rule applies to the `filters` of a lookup, rollup or count field.

`notIn` takes a list and keeps the records whose value is none of the listed values. A record with no value is kept by neither `in` nor `notIn`. `notIn` over an empty list leaves out nothing that has a value. A single value counts as a list of one, and a `null` in the list matches nothing.

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

A view's `read` grant decides which signed-in roles may use it — `'all'`, `'authenticated'`, or a list of roles and `group:<name>` entries, a group entry admitting the members of that group on the view list, the definition, its records and `?view=` alike; it is checked instead of the table's, not after it, so a view may open a table to roles the table refuses — what it serves still passes the reader's field grants and the table's row-level rule. A view with no `permissions` block has no grant of its own: it inherits the table's `read`, answering exactly the callers the table's records answer, and anyone else gets the same `404` as for a view that does not exist. `permissions: { public: true }` is the one shape meant to open a view past the session: visitors with no account can read its definition and its records, served only the columns its `fields` names (minus any the reader's field grants withhold), filtered and sorted on the server. The list of a table's views (`GET /api/tables/:t/views`) answers exactly the callers the table's records answer — anyone else gets the same `404` as for a table that does not exist — and names only the views the caller may open. It stays private, writes stay on the table's permissions, a public view must declare `fields`, and a table with `rowLevelPermissions` cannot have one.

```yaml
tables:
  - id: 1
    name: campaigns
    fields:
      - { id: 1, name: name, type: single-line-text }
      - { id: 2, name: status, type: single-line-text }
      - { id: 3, name: deadline, type: date }
      - { id: 4, name: owner_email, type: email }
      - { id: 5, name: disabled, type: checkbox }
    permissions:
      read: [admin, member]
    views:
      - id: open_campaigns
        name: Open campaigns
        fields: [name, status, deadline]
        filters:
          and:
            - { field: disabled, operator: isFalse, value: false }
        sorts:
          - { field: deadline, direction: asc }
        permissions: { public: true }
```

A visitor reads `GET /api/tables/campaigns/views/open_campaigns/records` and gets the enabled campaigns with their name, status and deadline — never `owner_email`. A `filter` they add only narrows the view's own, and a filter or sort on a column the view does not list is refused. Only `true` opens a view to a visitor: `read: 'all'` still means every signed-in role, a view with no permissions block means whoever the table's `read` admits, and a visitor asking for either gets the same answer as for a view that does not exist.

A view's own conditions keep narrowing the rows it serves even when they name a field the reader may not read, on `GET /api/tables/:t/views/:v/records` and `?view=` alike: they are the author's fixed values, not the reader's query, and the field itself is still never served or named to that reader.

The definition a view serves — `GET /api/tables/:t/views/:v` and each entry of the view list — names only what its reader may read. Its `fields`, filter conditions, `sorts` and `groupBy` keep the fields the reader's field grants admit and drop the rest, so neither the name of a hidden field nor a value filtered on it reaches that reader; a view whose filter or sort rests entirely on hidden fields is still listed, without those entries. A filter on a column the reader may read is published as written even when the view's `fields` leaves that column out, as `disabled` does above: it is the author's own constant, not a record's value. This holds for a visitor reading a public view as for any signed-in role.
