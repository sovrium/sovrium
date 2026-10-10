# Relative Dates

> Filter on a day or an instant relative to the request — `$today`, `$startOfMonth`, `$now-1h` — so a view of what is due or what just happened stays right on the day it is read.

A `dataSource` filter compares a field with a fixed value. A relative token in place of that value names a day or an instant counted from the moment the page is read, so the same config lists what is due this fortnight, this month or in the last hour without anyone editing it. **Data Binding** documents the filter itself and its operators.

## Relative days

A filter value may name a day relative to the day the page is read: `$today`, `$today+Nd` and `$today-Nd` for N days, `$today+Nw` and `$today-Nw` for N weeks, `$startOfMonth` and `$startOfNextMonth`. Each is resolved on the server for every request to a calendar day (the server's UTC day), on both SQLite and PostgreSQL, so a view of what is due in the next two weeks is right on the day it is read rather than on the day a record was saved. The records API resolves the same tokens in its `filter` parameter.

```yaml
name: my-app
tables:
  - name: tasks
    fields:
      - { name: title, type: single-line-text }
      - { name: due_on, type: date }
pages:
  - name: due-soon
    path: /due-soon
    components:
      - type: table
        dataSource:
          table: tasks
          filter:
            - { field: due_on, operator: gte, value: $today }
            - { field: due_on, operator: lte, value: $today+14d }
```

Months and years are anchors, never offsets: they have no fixed length. A value beginning with `$today` or `$startOf` that is not one of these tokens — `$today+1m`, say — is refused at boot, naming the tokens a filter may use.

## Relative instants

A filter on a `datetime` field may name an instant relative to the request instead: `$now`, and `$now+N` / `$now-N` with `m` for minutes, `h` for hours, `d` for days or `w` for weeks. `$now-1h` is the last hour, `$now-24h` the last day to the minute — where `$today-1d` reaches back to the start of yesterday. Each is resolved on the server, once per request, to a UTC instant rounded down to the minute, so a page using one changes at most once a minute. A value beginning with `$now` outside these tokens — `$now-1y`, `$now-90s` — is refused at boot.

```yaml
name: my-app
tables:
  - name: checks
    fields:
      - { name: monitor, type: single-line-text }
      - { name: checked_at, type: datetime }
pages:
  - name: last-hour
    path: /last-hour
    components:
      - type: table
        dataSource:
          table: checks
          filter:
            - { field: checked_at, operator: gte, value: $now-1h }
```

A window the reader picks — the last hour, day or week from a selector — is a page's `window`, filtered on `$window.start`; `$now` is for a window the page fixes.

## Related reading

- **Data Binding** — the `dataSource` filter and its operators.
- **Page References** — the page `window` a reader picks, read through `$window.start`.
- **Records Overview** — the same tokens in the `filter` query parameter.
