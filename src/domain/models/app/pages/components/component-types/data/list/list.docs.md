# Lists

> The `list` component — a vertical run of records drawn from a per-record template, with Load More paging.

A `list` draws one entry per record, from a template you declare. Reference: shadcn/ui Item. An `itemTemplate` list is an item group in one outline, in the `border` colour: each record is an item whose `image` is its media, whose `title` and `subtitle` are its content, and whose `badge` and `metadata` are its actions, with a separator between two rows and the `muted` surface under the pointer. Its `emptyMessage` is drawn as an Empty whose title is the message. Everything about presentation lives under `listDisplay`; what is fetched, and how much of it, belongs to `dataSource`. It binds the same way every data component does: to one of the table's views with `dataSource: { table, view }`, the view then owning the filter, sort, grouping and visible fields, or directly to the table with `dataSource: { table }` and its own optional `filter` and `sort`.

A list can also draw one of the account lists the server scopes to the reader: `dataSource: { auth: sessions }` lists the reader's own signed-in sessions, and `passkeys`, `apiKeys`, `members` and `invitations` work the same way. The last two need the reader to be allowed to administer accounts; for anyone else the list is not drawn. The rows carry the same fields as the grid's account lists. The list keeps its `props.aria-label` as its accessible name, and each item of the sessions list carries `data-session-current="true"` or `"false"`, so the device reading the page can be styled apart.

<!-- sovrium:options type:list depth=3 -->

```yaml
tables:
  - name: articles
    fields:
      - { name: title, type: single-line-text }
      - { name: published_at, type: datetime }
pages:
  - name: Articles
    path: /articles
    components:
      - type: list
        dataSource:
          table: articles
          sort: [{ field: published_at, direction: desc }]
          limit: 20
        listDisplay:
          itemTemplate:
            title: '$record.title'
            metadata: [{ field: published_at, format: relative-date }]
          loadMore: button
```

`itemTemplate` takes `title`, `subtitle`, `image`, `badge` and `metadata`, where `metadata` is an array of `{ field, format, options }` rendered in the item footer. A `format` that names a value format — `currency`, `relative-date`, `short-date`, `long-date`, `datetime`, `compact`, `percentage`, `bytes`, `yes-no` and the rest a table column accepts — is applied in the page's language, exactly as it is in a table cell — a `currency` entry in the bound field's own currency, precision and separators; any other word leaves the value as stored. A `currency` entry on a plain number field reads in the code its `options.currency` names — `{ field: budget, format: currency, options: { currency: EUR } }` prints `€48,000.00` — and falls back to US dollars when none is named; a `currency` field keeps its own code whatever `options.currency` says. A slot bound to a `user` field prints the account's name, not its id.

A list takes `onRowClick` like a grid row: `{ action: openSheet, component: <drawer id> }` opens the clicked item's record in that drawer and writes `?record=<id>&drawer=<drawer id>` into the address; `{ type: navigate, path: /deals?record=$record.id }` follows a path on this site filled with the item's values. A list item also takes `{ type: fill, target, field, value }`, which writes one of the item's values into a form control on the same page — a list of saved scripts beside a message box; see the `fill` action for its options. A click or Enter on the item runs it. The property is `onRowClick`, as on a grid.

When the binding returns no record, a list says its `listDisplay.emptyMessage` — whether its items come from `itemTemplate` or are drawn from `children` — and never draws its item template with the placeholders unfilled. The empty message accepts a `$t:` key, which prints the active language's text.

`listDisplay.hideWhenEmpty: true` draws nothing at all instead: no empty message, no empty box, no visible container. It turns a filtered list into a notice that appears only while its condition holds — a warning that an account is not linked to an accounting tool yet, listed from the one row that says so. A list with records draws them as usual, and a list without the key keeps its empty message. It works the same whether the server draws the list or the browser fetches its rows.

```yaml
- type: list
  dataSource:
    table: integrations
    filter:
      - { field: provider, operator: eq, value: pennylane }
      - { field: status, operator: eq, value: not-linked }
  listDisplay:
    hideWhenEmpty: true
    itemTemplate: { title: $record.label }
```

## A list inside another list's row

A list drawn from `children` may hold, in its row template, a list bound to a table of its own — the members under each team. The inner list reads its own records in every row of the outer one, with its own `filter`, its reader's permissions and its own `emptyMessage`, exactly as it would at the top of the page; `$record.` inside it reads the inner record. The outer row still fills the inner list's binding, so `filter: [{ field: team, operator: eq, value: $record.id }]` lists each team's own members.

## Groups come from the view

Bound to one of the table's views, a list draws the view's `groupBy`: a header per group carrying the group's value and its count, in the order the view's `direction` gives, each group's records in the view's sort, and the records whose grouping field is empty in one last group under a neutral heading. Each header opens and closes its group; a view whose `groupBy` declares `collapsed: true` starts with every group closed. A list bound directly to the table is not grouped — the grouping belongs to the view, so a list has no `groupBy` of its own. Only the view's first grouping level is drawn: a `thenBy` nested inside it, which a grid draws as sub-groups, is not drawn on a list, so its records stay in one group per first-level value.

```yaml
tables:
  - name: lessons
    fields:
      - { name: title, type: single-line-text }
      - { name: section, type: single-line-text }
    views:
      - id: by_section
        name: By section
        groupBy: { field: section, direction: asc }
pages:
  - name: Course
    path: /course
    components:
      - type: list
        dataSource: { table: lessons, view: by_section }
        listDisplay: { itemTemplate: { title: $record.title } }
```

## The reader's own row on each item

`dataSource.mine: { table, link, user, as }` gives each item the reader's own related row — her completion of a lesson, her enrolment in a course — as `$record.<as>`, empty when she has none. `table` holds those rows, `link` is its field pointing at the item, and `user` is its field naming the person: only rows naming the reader are read, through that table's own read rules, so another reader's row is never shown. Row visibility rules switch a control on it (`visibility: { record: { field: done, isNotEmpty: true } }`), and a `crud` action with `operation: toggle` and `mine: <as>` deletes that row when the item has one and creates it, with its link and person filled, when it does not. The toggle writes under the related table's create and delete permissions; a reader without them writes nothing, and the action's `onError` answers. `mine` is honoured by `list`, `gallery` and `progress`. On a list it needs the items drawn from `children`: beside `listDisplay.itemTemplate` it is refused when the config loads, since an item template is drawn in the browser, where the reader's row is not joined. On a list drawn by the server without a `props.id`, a toggle reloads the whole page rather than refreshing the list alone; with a `props.id`, only the list is refreshed.

```yaml
- type: list
  dataSource:
    table: lessons
    mine: { table: completions, link: lesson, user: member, as: done }
  children:
    - { type: text, content: $record.title }
    - type: button
      content: Mark complete
      visibility: { record: { field: done, isEmpty: true } }
      action: { type: crud, operation: toggle, table: completions, mine: done }
```

## Paging is the binding's business, not the display's

Page size comes from `dataSource.limit`: it sets how many records the first page holds, and each press of Load More appends another page of that size. The button reads « Load More » in the page language (`sovrium.list.loadMore` renames it; a gallery's is `sovrium.gallery.loadMore`).

`loadMore: button` renders the control that does the appending. On a `dataSource.system` binding it appears only if that binding also declares `totalKey` **and** the endpoint answers a number there — without one the reported total is the page's own length, so there is never anything left to load.

`maxItems` caps how many records the list DRAWS. It does not change what is fetched — a page is transport, a cap is display — so a list at its cap hides the Load More control, since anything the next page brought would be cut off on arrival. To fetch fewer records, set `dataSource.limit` instead.

## Row layout

`listDisplay.itemLayout` sets how each row lays out its title and its details. `inline`, the default, keeps the row on one line and truncates the title to leave room for the badge and the metadata. `stacked` gives the title the row's full width — wrapped, never cut — and lays the badge and metadata on the line below: the shape a narrow column, such as a dashboard's side panel, reads best. A list's inner elements take classes by part — `list` (the list holding the rows), `item`, `title`, `subtitle`, `meta` — through `classes`. A `metadata` entry takes a `className` of its own, layered over `meta`, for the one detail that must read differently from the others: `{ field: due_date, className: 'font-medium text-error' }`.

## Loading more rows

`loadMore: button` draws a "Load more" button under the rows; each press appends the next page. `loadMore: infinite` appends the next page as the reader scrolls to the last row, keeps the same button for a reader without a pointer, marks the list busy while a page is on its way and announces how many records are loaded. Both stop at the end of the set, where the button is removed, and neither reaches past `maxItems`.

## Two keys are accepted and then ignored

Stated here rather than left to be discovered: `highlight` and `divider` have **no effect**. Each decodes cleanly and changes nothing.

They are documented because an unread key is the hardest kind of config to debug: it validates, it renders, and the behaviour it names never arrives.
