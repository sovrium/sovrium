# Tables & Filter Bars

> The data grid — columns, selection, bulk actions, grouping and summaries — plus the filter-bar that narrows it and everything else listening on the same channel. Editing in the grid has its own page.

`table` is the grid. Bind it to a table or to a read endpoint with `dataSource`, or omit the binding and it draws the `tableHeaders` and `tableRows` you author; declaring both is refused.

<!-- sovrium:options type:table depth=3 -->

`rowHeight` is `medium` by default, with `short` and `tall` on either side. `layout: fill` sizes the grid to a bounded parent and gives it the scroll — rows scroll inside the grid, the header row stays pinned, and the pager stays at the bottom edge. It needs an ancestor with a resolved height, and inside a tab panel it needs the tab set to declare `layout: fill` too, which this key cannot reach on its own. `toolbar` is a record of booleans selecting which controls appear: `search`, `filters`, `sort`, `export`, `refresh`, `density`, `columnToggle`, `groupBy`, `views`, `viewSwitcher`.

## `onRowClick`

A row click accepts exactly two shapes: `{ type: navigate, path }`, which navigates with `$record.<field>` tokens replaced from the clicked row; and `{ action: openDrawer, component }`, which opens the sibling `drawer` with that `id` — note that `openDrawer` is keyed on `action`, not `type`.

Every other action type — `auth`, `crud`, `automation`, `filter`, `toast`, `fetch` — is **rejected** here, because a row click has never run them. Richer behaviour belongs on the opened drawer's own `actions`, where the full action set is available: open the record in a drawer, then act on it from there.

## `rowExpand`

Opening a row's full record is a property of the grid, so it needs no sibling component and no id to keep in step. `true` expands rows into a panel derived from the bound table; `false` is the same as omitting the key, so an expand can be switched off in place; an object of `{ fields, canEdit, title }` narrows the field list, makes the panel read-only and names it.

**With no `fields`, the panel shows every declared field of the bound table, in declared order** — not the visible `columns`. The reason to expand a row is to see what the row cannot show, so deriving from the columns would make expand a no-op on a grid that already displays everything. Each field keeps the `label` and `description` it declares. An explicit `fields` list narrows and reorders the panel, and may name a field that is not a column.

```yaml
- type: table
  dataSource: { table: deals }
  columns: [{ field: name }, { field: stage }]
  rowExpand:
    fields: [name, stage, notes]
    canEdit: false
    title: Deal detail
```

**`rowExpand` and `onRowClick` cannot both be declared.** A row has one click, and two answers to what it does is a config whose halves cannot both apply — so it is refused rather than one silently winning. `rowExpand: false` alongside `onRowClick` is fine, since `false` is off.

**`rowExpand` is also refused on a grid bound to a read endpoint.** The panel derives its controls from the bound table's field schema, and a read endpoint has none. Use a `drawer` with `dataSource.system` and its own `recordFields`, opened with `onRowClick: { action: openDrawer, component }`. That hand-wired form is unchanged and is not deprecated: `rowExpand` is a shorthand for the common case, not a replacement — the drawer can still bind a different table from the grid's, bind a read endpoint, be shared by two grids, and carry footer `actions`.

### What a click means

A row can carry several meanings at once. The **target** decides, never the timing. A click on an editable cell opens the cell editor on double-click and does not expand the record; on the selection checkbox it selects the row and nothing else; on a group header it folds or unfolds that group at any nesting level; on any other cell it expands the record.

Rows stay reachable from the keyboard: a row carrying an action is focusable and answers `Enter`, and no per-row button is added.

## `columns`

A column is either a **field column** or an **action column** (`type: actions`, carrying `actions`, each `{ label, action, icon, confirm, visibleWhen, editSelect, variant }`). An action's `variant` is its visual weight — `default`, `secondary`, `ghost` or `destructive` — and naming it is the only way to get one: omit it and the button paints as it always has, since a trigger opens a question and a column of red buttons makes the question look answered. A `confirm` prompt never implies `destructive`.

An action column also takes `capability`, which withholds the whole column — header included, and its action endpoints with it — from a caller who lacks the named power.

A field column's `format` chooses the cell rendering: `truncate`, `currency`, `percentage`, `compact`, `bytes`, `relative-date`, `relative-time`, `short-date`, `long-date`, `datetime`, `yes-no`, `check-cross`. `cellStyle` applies `{ when: { <operator>: value }, className }` rules per cell, over the operators `eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `lt`, `gte`, `lte`.

```yaml
columns:
  - field: status
    frozen: true
    cellStyle: [{ when: { eq: overdue }, className: 'text-red-600' }]
  - type: actions
    actions: [{ label: Delete, action: { type: crud, operation: delete, table: tasks } }]
```

## Selection, grouping and summaries

`selection` takes a required `mode` — `none`, `single` or `multiple` — plus `showCheckboxes`. Each `bulkActions` entry is `{ label, icon, action, confirm }`, where `confirm` is the dialog wording and may contain `{count}`, replaced with the number of selected rows.

`groupBy` accepts `field`, `direction` (`asc` by default), `collapsed`, and `thenBy` — up to two further levels nested inside the first, three in total. `summary` accepts `field`, `label` and `function`: one of `count`, `sum`, `avg`, `min`, `max`.

`direction` orders the group headers themselves, not the rows inside a group — those follow `dataSource.sort` and the column headers. Grouping by a single-select or status field orders the headers by the field's **declared option order** rather than alphabetically, so a `stage` of `prospect`/`qualified`/`won` reads in the order it was authored. Each header also counts the whole result set: a group holding 30 records reads `(30)` even on a page showing 22 of them, and that holds at every level.

Every level answers for itself. `direction` applies per level and independently, `collapsed` is per level too, and folding nests. A field named by any level need not be a visible column; the header carries its value, which is often the reason to group by it. Naming the same field at two levels is refused at validation: every record in a group already shares the value that group was formed on, so a repeated level puts exactly one sub-group inside each group and partitions nothing.

**A declared `summary` describes the grid as a whole, and once the grid is grouped it additionally describes each group — at every level, not only the innermost.** There is no second option to turn this on. Because every level is summarised the figures reconcile: a `sum` over the sub-groups of one parent equals that parent's, and the parents' equal the footer's. Group totals stay visible when a group is collapsed, which is what makes collapsing everything a useful way to compare groups, and each is rendered in its column's `format`.

```yaml
- type: table
  dataSource: { table: deals }
  pagination: { pageSize: 25 }
  groupBy:
    field: region
    direction: asc
    thenBy:
      - { field: stage, direction: desc }
      - { field: owner, collapsed: true }
  summary:
    - { field: name, function: count, label: Deals }
    - { field: value, function: sum, label: Pipeline value }
```

Regions read in their declared order, the stages inside each region read in reverse, and the owners inside each stage start folded. `owner` is not among the columns, and does not need to be.

**On a `dataSource.system` binding, a summary describes the rows the endpoint returned.** A grid bound to a table asks the database for its totals, so the footer answers for the whole collection whatever page you are on. A read endpoint answers with rows and no totals, so the figures are computed from the rows in hand — the grid asks for them without its own page window, keeping the same endpoint, static params, sort and search term. Two windows stay in place, because in both the narrowing is somebody's deliberate choice rather than the grid's paging: a `limit` the binding declares, and a feed walked by cursor. That is a real difference in what the number means: a `sum` under a table binding is the sum of everything, and under a system binding it is the sum of what came back. Empty cells are left out of both rather than counted as zero.

**Where a selection export gets its rows depends on the same binding.** A grid bound to a table sends the ticked ids to the records-export endpoint, so the file can carry rows from pages the browser never fetched, formatted as each column declares. A grid bound to a read endpoint has no table to address, so it writes the CSV itself — the rows it is holding, over the columns still on screen, with the values as the endpoint returned them — and names the file after the endpoint's last segment.

## `rowColorField`

Names a field whose declared option colours fill each row. It is spelled `rowColorField` rather than `colorField` because a grid already decides colour per column, where a bare `colorField` would read as "colour the cells".

The fill comes from the option colours declared on the named field, and the row's text colour is derived from it so it stays legible against any hue. Unlike a calendar or timeline, **a grid invents nothing**: a value whose option declares no colour is not filled, and neither is an empty value or a grid with no `rowColorField` at all. There is no fallback palette.

**A filled row suppresses `striped`.** Striping, hover and selection are all painted as row backgrounds, and on a filled row the background belongs to you rather than to the grid's chrome — so a filled row drops all three and wears its selection and hover as inset shadows instead. The suppression is per row, not per grid.

Unlike the record views' `colorField`, this one is checked: `sovrium validate` rejects a `rowColorField` naming a field that does not exist on the bound table, because an unfilled grid looks identical whether the name was a typo or the colours were deliberately left undeclared.

## `filter-bar`

One set of conditions, published to every data component listening on the same channel.

<!-- sovrium:options type:filter-bar depth=3 -->

Each entry of `fields` takes `name` — the column, as the subscribers' tables spell it — an optional `label`, an optional `kind`, and for `kind: select` an `options` list of `{ value, label }`. Each entry of `conditions` takes `field`, `operator` and `value`. `combinator` is `and` by default and the reader can change it once there are two conditions; `allowAdd` defaults to true, and off leaves existing chips removable.

```yaml
components:
  - type: filter-bar
    publishes: { bindTo: invoices-filter }
    fields:
      - { name: amount, label: Amount, kind: number }
      - { name: issued_at, label: Issued, kind: date }
    conditions:
      - { field: status, operator: eq, value: paid }
  - type: table
    dataSource: { table: invoices, bindTo: invoices-filter, sharedFilter: {} }
```

**`publishes.bindTo` is required, and the bar is bound to no table.** A bar with no channel narrows nothing — and unlike an unread styling key, that is not harmless: it is a control a reader will operate and watch do nothing. There is no default to fall back on, because guessing the component's own `props.id` publishes a key nothing reads.

The bar itself has **no** `dataSource`, which is why `fields` is declared rather than derived — and why one bar can drive subscribers over _different_ tables. Every component naming that channel in `dataSource.bindTo` beside `sharedFilter: {}` re-reads when the conditions change, whichever table it reads from.

The operators are the ones the server can execute: `eq`, `neq`, `contains`, `gt`, `lt`, `gte`, `lte`, `in`. `kind` decides which of them a field offers and what control is drawn for the value — `text` gives is / is not / contains, `number` and `date` the comparisons, `select` is / is not / is any of. A `conditions` entry naming a field the bar does not offer in `fields` is **refused at boot**, by name, rather than published and quietly ignored.

A filter written into `dataSource.filter[]` is part of the binding: it is always applied and a reader cannot lift it. The bar's `conditions` are published on first render too — so a page can land already filtered — but each arrives as a chip the reader can remove.
