# Data Binding

> Bind a page or component to a table with `dataSource` — filters, sorts, modes, pagination, route binding, and the publisher/subscriber channel two components share.

`dataSource` binds a page or a component to a table. The records it resolves become available to every descendant through `$record.<field>` references, which **Page References** documents.

```yaml
name: my-app
tables:
  - name: tasks
    fields:
      - { name: title, type: single-line-text }
      - { name: status, type: single-select, options: [open, archived] }
      - { name: created_at, type: created-at }
pages:
  - name: Tasks
    path: /tasks
    components:
      - type: table
        dataSource:
          table: tasks
          filter:
            - { field: status, operator: neq, value: archived }
          sort:
            - { field: created_at, direction: desc }
          pagination: { pageSize: 25, style: numbered }
```

## `dataSource` properties

<!-- sovrium:options DataSourceSchema depth=2 -->

A component may bind to a platform endpoint instead of a table, inline through `dataSource.system`, or by name through a **System Sources** catalogue entry.

## Declaring what a source listens to

`bindTo` and `sharedFilter` describe a SUBSCRIBER. The publisher half is `publishes` on a control:

```yaml
name: my-app
pages:
  - name: Roles
    path: /roles
    components:
      - type: select
        props: { id: tier-filter, label: Filter by tier }
        options: [{ value: admin, label: Admin }, { value: member, label: Member }]
        publishes: { bindTo: roles-filter, param: tier }
      - type: select
        props: { id: state-filter, label: Filter by state }
        options: [{ value: active, label: Active }, { value: archived, label: Archived }]
        publishes: { bindTo: roles-filter, param: state }
      - type: table
        dataSource:
          system:
            endpoint: /api/admin/roles
            rowsKey: roles
            bindTo: roles-filter
            sharedFilter: {}
        columns: [{ field: name, label: Name }]
```

`publishes.bindTo` names a CHANNEL, not the control's own id. Several controls may share one, each contributing its own `param`, and their contributions are merged — so the grid above re-reads once with BOTH keys, and a third filter can be added without touching it.

`param` is required and never inferred. Guessing the control's own id would publish one key to an endpoint that reads another — a filter that validates and quietly narrows nothing. Two controls contributing the same key to one channel is refused at startup, since each emit would erase the other, as is a subscriber consuming a key its channel never publishes.

A component bound to a **cursor-paginated** platform endpoint pages differently: it offers a single load-more control that appends rows, and shows no total and no pager — even when `pagination` is declared, because such an endpoint never reports how many rows exist. **System Sources** has the full behaviour.

## Binding to the route

A page's `path` can carry a `:segment`, and two bindings read the value the request matched — so ONE page definition serves a different collection, or a differently scoped set of records, per URL.

**`param` on a system source** substitutes the matched segment into the endpoint's own placeholder:

```yaml
name: my-app
pages:
  - name: browse
    path: /items/:group
    components:
      - type: list
        dataSource:
          system:
            endpoint: /api/tables/:group/records
            param: group
            rowsKey: records
        listDisplay:
          itemTemplate: { title: $record.name }
```

**`$param.<name>` in a filter** substitutes it into a condition on a table binding instead. It sits in the same position as a `$currentUser` reference and resolves the same way — server-side, per request. The difference is where the value comes from: the session, or the URL.

Both names must be declared by the page's own `path`. A name with no matching `:segment` is refused at startup, naming both the reference and the path — because at runtime it would silently request a URL containing a literal placeholder, or compare a field against nothing at all.

### Wherever a string is

`$param.<name>` is not limited to a filter. It resolves in **every string** a page's `components` and `layout` are made of — an action URL, an upload target, a piece of copy, a value handed to an interactive component:

```yaml
name: my-app
pages:
  - name: bucket-files
    path: /buckets/:bucket
    components:
      - type: file-upload
        uploadAction: /api/admin/buckets/$param.bucket/files
      - type: text
        content: Files of $param.bucket
```

That reach is the point: an object-scoped page does not only READ its selection, it writes with it. Substitution happens on the server, before the page is sent, so no reference ever reaches the browser to be sent back as a literal path segment.

Two limits, both deliberate. **`meta` is out of reach** — a page title naming `$param.bucket` renders the reference verbatim, because the pass walks `components` and `layout`, which is what the `$app` and `$query` passes walk. And **a shared system-source catalogue entry cannot use one**, since it has no host page whose `path` could declare the segment.

### Binding the table itself

`dataSource.table` accepts a reference too, which makes ONE page definition a records explorer over every table the app declares. Pair it with `columnsFrom: table`, because a page that learns its table at request time cannot enumerate its own columns:

```yaml
name: my-app
pages:
  - name: records
    path: /records/:table
    components:
      - type: table
        dataSource: { table: $param.table }
        columnsFrom: table
```

`columnsFrom: table` derives one column per declared field, in declaration order, **honouring field-level read permissions**: a field the caller may not read yields no column, and its name never reaches the page. It is mutually exclusive with `columns` and requires a `dataSource.table`; both are refused at startup.

**A segment naming no declared table answers 404, not an empty grid.** "This table does not exist" and "this table is empty" must not look the same to somebody staring at a grid with no rows. The 404 also tells the caller nothing about which table names exist.

Binding the table this way — rather than pointing the grid at a records endpoint as a system source — is what keeps the record features: inline editing, the typed create dialog, saved views and density are all unavailable over a system source, which has no records table to write to.

## Filter operators

| Operator     | Matches                                                    |
| ------------ | ---------------------------------------------------------- |
| `eq` / `neq` | Equal, not equal.                                          |
| `gt` / `gte` | Greater than, greater than or equal.                       |
| `lt` / `lte` | Less than, less than or equal.                             |
| `contains`   | Substring match, ignoring case.                            |
| `in`         | Value is one of an array — used with `$currentUser` lists. |

Conditions combine with AND. There is no OR at this level; express alternatives as a saved view or a separate component.

## Single and search modes

`mode: single` resolves exactly one record, read from the route parameter named by `param` — the pattern behind record detail routes in **Routing & Paths**.

`mode: search` filters across `searchFields` as the visitor types, throttled by `debounceMs` and capped by `limit`:

```yaml
name: my-app
tables:
  - name: articles
    fields:
      - { name: title, type: single-line-text, indexed: true }
      - { name: summary, type: long-text, indexed: true }
pages:
  - name: Articles
    path: /articles
    components:
      - type: list
        dataSource:
          table: articles
          mode: search
          searchFields: [title, summary]
          searchEngine: client
          debounceMs: 250
          limit: 20
```

`searchEngine` names the backend, and `client` — the default when the key is omitted — is the only one this mode implements: the bound rows travel to the browser and the filtering happens there. `fts`, `trigram` and `hybrid` are accepted by `sovrium validate` and reserved for the server-side engines, but a component declaring one searches exactly as `client` does today. **Search Overview** sets out all four, and the three other places a query can run when you need the database to do the searching.

## Pagination

`pagination` takes a `pageSize`, which is required whenever the block is present, and an optional `style` defaulting to `numbered`. `numbered` draws numbered page navigation; `loadMore` draws a button appending the next page.

`infinite` is accepted but is not implemented. Scroll-triggered paging needs a sentinel row, an intersection observer and a re-entrancy guard, and none of that ships until something specifies how it behaves at the end of the set. A component declaring it pages exactly as `numbered` does, so the gap costs you the scrolling interaction and never a record.

There is deliberately no "draw no control" style. `pageSize` already narrows what a component draws, so a style that rendered nothing would leave the rest of the set unreachable. To put every record on one page, omit `pagination` rather than reaching for a style.

## Related reading

- **Page References** — `$record`, `$vars`, `$currentUser`, `$session`, and the page inputs `query` and `window`.
- **Data Components** — the components that consume a source.
- **System Sources** — binding to platform endpoints by name.
- **Table Views** — saved filters and sorts.
- **Layouts, Sidebars & Access** — the `access` gate.
