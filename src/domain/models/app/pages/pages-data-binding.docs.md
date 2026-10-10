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

A page's `path` can carry a `:segment`, and two bindings read the value the request matched — so ONE page definition serves a different collection, or a differently scoped set of records, per URL. **`param` on a system source** substitutes the matched segment into the endpoint's own placeholder:

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

A `$currentUser` reference in a `dataSource.filter` is resolved on the server for every data component — table, kanban, calendar, gallery, chart, kpi, timeline and list — wherever it sits on the page, including inside containers. A visitor who is not signed in gets the same 401 whether the filter sits at the top of the page or three containers down. Both names must be declared by the page's own `path`. A name with no matching `:segment` is refused at startup, naming both the reference and the path — because at runtime it would silently request a URL containing a literal placeholder, or compare a field against nothing at all.

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

**A segment naming no declared table answers 404, not an empty grid.** "This table does not exist" and "this table is empty" must not look the same to somebody staring at a grid with no rows. The 404 also tells the caller nothing about which table names exist. Binding the table this way — rather than pointing the grid at a records endpoint as a system source — is what keeps the record features: inline editing and the typed create dialog are unavailable over a system source, which has no records table to write to.

## Reading through a view

Every data component that reads a table — `table`, `kanban`, `calendar`, `gallery`, `list`, `chart`, `kpi` — binds either to one of the table's views or directly to the table. A way of looking at the records that should last — a filter, a sort, a grouping, a set of visible fields — is a view declared on the table, never something a component carries or a reader saves. A board, a calendar and a grid of the same records are three components, each with its own binding.

`dataSource.view` names one of the bound table's views by id or name. The component reads through that view on the server: its filters, sorts, grouping and `fields` apply, and the component may not repeat them — a `filter`, `sort` or `fields` written beside `view` is refused when the config loads, naming the view. What the component keeps is how it draws the records: a grid's `columns`, a board's `kanbanGroupBy`, a calendar's `dateField`, a chart's axes. Bound directly to the table, a component may narrow it with its own `filter` and `sort`. A filter bar subscribed through `bindTo` and `sharedFilter` still narrows a view-bound component, as a reader's toolbar filters do.

Bound to a public view, a page with no access rule shows the records to visitors who are not signed in — whichever component reads the view: a grid, a board, a calendar, a gallery, a list, a chart and a KPI all serve the visitor the view's rows and fields, and nothing past them, even when the table itself is closed to her. A board, calendar, gallery, chart or KPI on a view that does not admit its reader leaves the page. A view-bound grid lets a reader the table lets write create and edit records, on the fields the view shows; a reader without write access, and a visitor on a public view, get it read-only. It opens no live refresh. A `summary` row totals the rows the view returns — its filters included — rather than the whole table. Export stays off: the export reads the table, not the view, so it would hand a reader the fields and rows the view exists to withhold; bind the grid to the table with a filter where an export is needed.

```yaml
name: campaign-portal
tables:
  - id: 1
    name: campaigns
    fields:
      - { id: 1, name: name, type: single-line-text }
      - { id: 2, name: deadline, type: date }
      - { id: 3, name: owner_email, type: email }
    permissions:
      read: [admin, member]
    views:
      - id: open_campaigns
        name: Open campaigns
        fields: [name, deadline]
        permissions: { public: true }
pages:
  - name: campaigns
    path: /campaigns
    components:
      - type: table
        dataSource:
          table: campaigns
          view: open_campaigns
        columns:
          - { field: name, label: Campaign }
          - { field: deadline, label: Deadline }
```

`view` on a component that does not read records (a form), beside a `system` source, or naming a view the table does not declare stops the config from loading. The page is told only the view's columns, less any its reader may not read, so a column the view leaves out — or masks from that reader — never reaches the browser. A view that is not public still needs a signed-in reader its own grant admits; anyone else sees the grid's error state.

## Filter operators

| Operator     | Matches                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| `eq` / `neq` | Equal, not equal.                                                          |
| `gt` / `gte` | Greater than, greater than or equal.                                       |
| `lt` / `lte` | Less than, less than or equal.                                             |
| `contains`   | Substring match, ignoring case.                                            |
| `in`         | Value is one of an array — used with `$currentUser` lists.                 |
| `isEmpty`    | No value — NULL, empty text, an empty list or an empty object. No `value`. |
| `isNotEmpty` | The field holds a value. No `value`.                                       |

Conditions combine with AND. There is no OR at this level; express alternatives as a view on the table or a separate component.

A filter value may also be a day or an instant relative to the request — `$today+14d`, `$startOfMonth`, `$now-1h` — resolved on the server for every request; **Relative Dates** lists the tokens.

## Single and search modes

`mode: single` resolves exactly one record, read from the route parameter named by `param` — the pattern behind record detail routes in **Routing & Paths**. A `filter` narrows which record that is: the binding reads the first record its filter matches, and with a `param` too, the record the route names only when the filter admits it. A record the filter leaves out answers as one that does not exist. `$param.*` and `$currentUser.*` in that filter resolve as they do in a list, so `filter: [{ field: project, operator: eq, value: $param.id }]` binds a form to the budget of the project its page shows. On a page bound this way, `$record.createdAt` and `$record.updatedAt` print when the record was created and last changed, as a date and a time in the page's language; `$record.createdAt.raw` prints the ISO 8601 instant the records API gives. A component that declares its own `dataSource` on a page bound to one record reads its own record: `$record.<field>` in its `content`, its text and its `props` comes from the record its `dataSource` reads, typed by that table. The page's record still fills the component's `dataSource` — that is how a nested binding follows the page, as in `filter: [{ field: invoice, value: $record.id }]` — and every component without a `dataSource` reads the page's record.

A page bound to one record with `mode: single` shares that record with the forms nested on it. A `form` anywhere on the page whose `dataSource` names the page's table and declares no `mode` of its own opens with the record's values, and saving it updates that record. A form bound to another table, or one whose `crud` action is `create` or names another table, is unaffected and opens empty. The record follows the visitor's own read permissions wherever it lands: a form bound with its own `mode: single`, a form that inherits the page's record, and the page's own `$record.*` text all carry only the fields that visitor may read, and a form carries only the fields it lists. A field the visitor may not read is never filled in and never printed, and saving the form leaves it as it was. A page bound to a record the visitor may not read — because the table's `read` refuses them or its row-level rule hides that row — answers 404, as for a record that does not exist. `mode: search` filters across `searchFields` as the visitor types, throttled by `debounceMs` and capped by `limit`. A search list draws its own search box and its rows wherever it is placed — at the top of a page, or inside a `container`, a `flex` or any other layout component — and combines with a `filter`, a `sort` and a `listDisplay.itemTemplate` the same way in every position. This one searches two fields:

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

Rows a page reads on the server follow the visitor's read permissions exactly as the records API lists them for that visitor: a list, a container's per-row `children`, and every row a search hands to the browser carry only the rows the table's row-level read rule shows them, and no field they may not read — a part of the row template naming such a field is left out, however deep in the template it sits. A pager counts those rows alone. In a list's row template, `$record.<attachment>` — an attachment column of the bound table — is the file's address, ready for an `image` `src` or a link `href`: on a private bucket a download link signed for that page view and valid for one hour, on a public bucket the bucket's files address `/api/buckets/<bucket>/files/<key>`. Its parts are `.key` (the storage key), `.url` (the same address), and `.name`, `.size` and `.mimeType` (what was stored with the file, empty when the column recorded none); a `multiple-attachments` column answers for its first file. Only a value the visitor may read gets an address, and the link opens for her even when the bucket's own `download` roles would not let her fetch the file, as the records API's link does. The presence flags (`isEmpty`, `isNotEmpty`) still read the stored value. `sovrium validate` warns on a bare attachment token written inside a files address (`/files/$record.<attachment>`), naming its place and the `.key` spelling.

A record in the trash is drawn on no page, as the records API answers it as one that does not exist: a list, a search and a pager leave it out, a component bound to it with `mode: single` draws nothing of it, and a page bound to it by its own `dataSource` answers 404. A `mode: single` binding with no `param`, on a path with no matching segment, shows the first record the visitor may read that its `filter`, when it declares one, matches — whether it is a component's binding or the page's own `dataSource`: a record the row-level rule hides from her, or one in the trash, is passed over rather than answering the page 404. A page bound this way answers 404 only when the visitor may read no record of the table.

In an app with `auth`, a visitor who is not signed in may read a table on a page only when its resolved `permissions.read` is `all`, the rule the records API applies to her: a table with no `permissions` block shows her none of its rows. A component bound to a table the visitor may not read carries nothing of that table into the page — no row, no field name, no option of a field. A grid renders empty, without its columns; a `kanban`, `calendar`, `gallery`, `chart`, `timeline` or record `drawer` is left out of the page entirely; a `kpi` keeps its card and its `label`, which are the author's words, with a neutral value in place of the figure.

On a table the visitor may read, every list of fields a component draws names only the fields she may read, and offers an input only on one she may write: a grid's configured column on a field she may not read is neither drawn nor named, a create `form` that lists no `fields` offers inputs for the fields she may write alone, and a drawer's `related` section with no `columns` heads only the fields she may read.

`searchEngine` names the backend, and `client` — the default when the key is omitted — is the only one this mode implements: the bound rows travel to the browser and the filtering happens there. `fts`, `trigram` and `hybrid` are accepted by `sovrium validate` and reserved for the server-side engines, but a component declaring one searches exactly as `client` does today. **Search Overview** sets out all four, and the three other places a query can run when you need the database to do the searching.

## Pagination

`pagination` takes a `pageSize`, which is required whenever the block is present, and an optional `style` defaulting to `numbered`. `numbered` draws numbered page navigation; `loadMore` draws a button appending the next page. `infinite` is accepted but is not implemented: scroll-triggered paging needs a sentinel row, an intersection observer and a re-entrancy guard, and none of that ships until something specifies how it behaves at the end of the set. A component declaring it pages exactly as `numbered` does, so the gap costs you the scrolling interaction and never a record. There is deliberately no "draw no control" style: `pageSize` already narrows what a component draws, so a style that rendered nothing would leave the rest of the set unreachable. To put every record on one page, omit `pagination` rather than reaching for a style.

A container bound to a table with per-row `children` — a feed of event cards — draws one copy of its children per row, on the server, wherever it sits on the page: at the top level or nested inside another container. The rows are plain layout blocks with no list marker before them, so a one-row stats card reads as a card rather than as a bulleted item. `dataSource.limit` caps how many rows it draws, so `limit: 3` shows the first three; with a `pagination.pageSize` as well, a page draws the smaller of the two and the pager counts no more than `limit` rows. Such a section is drawn once per request and does not follow a filter bar; a list that must follow one takes a `listDisplay.itemTemplate`, and cards that must follow one are a `gallery`.

## Related reading

- **Page References** — `$record`, `$vars`, `$currentUser`, `$session`, `$invitation`, and the page inputs `query` and `window`.
- **Data Components** — the components that consume a source.
- **Relative Dates** — `$today`, `$startOfMonth` and `$now` filter values.
- **System Sources** — binding to platform endpoints by name.
- **Table Views** — saved filters and sorts.
- **Layouts, Sidebars & Access** — the `access` gate.
