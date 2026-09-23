# System Sources

> Declare reusable read endpoints once and bind data components to them by name, instead of repeating raw REST paths across your config.

Data components normally bind to a table. Some do not: a runs grid, an audit log, or a global-search result list reads from a platform endpoint that is not one of your tables.

You can bind such a component inline with a `dataSource.system` block. The moment two components read the same endpoint, that raw path is duplicated in your config. The root `systemSources` catalogue declares each endpoint once, under a name:

```yaml
name: my-app
systemSources:
  - name: runs
    endpoint: /api/admin/automations/runs
  - name: failed-runs
    endpoint: /api/admin/automations/runs
    query:
      status: failed
```

Components then reference the name through `dataSource.systemSource`.

## Entry properties

<!-- sovrium:options SystemSourceSchema depth=2 -->

A catalogue entry is a drop-in for the inline `system` form — a referencing component reads exactly the same fields it would have read inline, so switching between the two never changes the component.

## Two sources, one endpoint

`query` is what makes named sources worth declaring. The same endpoint with different static parameters becomes two distinct, self-describing sources:

```yaml
name: my-app
systemSources:
  - name: open-tickets
    endpoint: /api/admin/tickets
    query:
      status: open
  - name: closed-tickets
    endpoint: /api/admin/tickets
    query:
      status: closed
```

Each is then one word at the binding site, and the filter lives in one place rather than being restated in every component.

## Which components accept one

Any data-bound component: `table`, `list`, `gallery`, `kanban`, `calendar`, `chart`, `kpi` and `timeline`. **Data Components** documents what each renders.

## An arbitrary row template

Those components each draw rows in a FIXED shape. When none of them is the shape you need, give a plain layout component the source and one child — the child becomes a template, cloned once per row with `$record.*` filled in:

```yaml
name: my-app
pages:
  - name: Roles
    path: /roles
    components:
      - type: container
        props: { id: role-cards }
        dataSource:
          system: { endpoint: /api/admin/roles, rowsKey: roles, idKey: name }
        children:
          - type: text
            props: { data-testid: 'role-card-$record.name' }
            content: 'Role: $record.name'
```

This is the same expansion a table-bound source uses, so `$record.*` and per-row record visibility behave identically on both. It runs on the SERVER: the rows are in the response body, and the endpoint never reaches the browser.

The read borrows the requesting visitor's own credentials, so a row somebody may not see never reaches a page rendered for them. An endpoint they cannot read yields no rows and the component renders its own empty state — never an error, which would let a visitor enumerate the admin surface by watching which paths break.

**Read-only.** A live submit control inside the template — a form at any depth — is refused at startup. A system row has no table identity, so there are no field permissions to apply and no write path the platform owns. Put the form on a page of its own.

## Cursor feeds

Some platform endpoints paginate by **cursor** rather than by page number: each response carries a token for the rows after the ones it returned, and reports no total. Automation runs, the audit log and agent conversations all read this way — a feed still being written to has no stable count to report.

A grid bound to such a source gets a different surface from the numbered pager. Where a page-numbered source draws previous and next controls, replaces each page with the one after it, and shows a running total, a cursor feed draws a single **load more** control, **appends** each page below the rows already on screen, and shows no total at all.

**This holds even when the component declares `pagination`.** A `pageSize` still sets how many rows each request asks for, but the pager it would otherwise draw is not rendered and no total is shown. That is not a gap to work around: a cursor endpoint never reports how many rows exist, so any total on screen would be a number the server never sent — and an operator reads a displayed total as a count.

Appending rather than replacing follows from the same shape. A cursor only moves forward, so swapping the first page out for the second would put rows the reader has already seen out of reach for the rest of the session.

Changing the search term, the sort or a filter starts a different sequence, so the accumulated rows and the token are both dropped and the feed restarts from the top. Load more carries the active search and sort into the next request, so a continuation never silently widens back to the unfiltered feed.

## Page size

`query` can set the page size for the endpoint itself:

```yaml
name: my-app
systemSources:
  - name: recent-runs
    endpoint: /api/admin/automations/runs
    query:
      limit: '5'
```

A `limit` declared this way **wins over the component's own page size**. Naming it on the source is the author saying what a page of _this endpoint_ is, which is the more specific statement — and it applies to every component bound to the source, so two grids reading the same feed cannot disagree about how much they ask for.

Leave `limit` out and the component's own `pagination.pageSize` is used instead.

## Validation

The catalogue must declare at least one source when present, every `name` must be unique — a duplicate would make a reference ambiguous — and every reference must point at a declared entry. All three are checked when the config is decoded, so `sovrium validate` catches a mistyped reference offline, before the app boots.

**System sources are read-only.** They fetch rows for display. Writes go through the records API or an automation.

## Related reading

- **Data Binding** — the `dataSource` module, table binding, and the inline `system` form.
- **Data Components** — the components that consume a source.
- **Pages Overview** — where a bound component sits in the page tree.
- **API Reference** — the endpoints a system source can read.
