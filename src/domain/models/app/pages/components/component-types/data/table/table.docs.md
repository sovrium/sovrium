# Tables & Filter Bars

> The data grid — columns, selection, bulk actions, grouping and summaries — plus the filter-bar that narrows it and everything else listening on the same channel. Editing in the grid has its own page.

`table` is the grid. Bind it to a table or to a read endpoint with `dataSource`, or omit the binding and it draws the `tableHeaders` and `tableRows` you author; declaring both is refused. A table written with `tableHeaders` and `tableRows` draws its rows on whole pixels.

A grid binds either to one of the table's views (`dataSource: { table, view }`) or directly to the table (`dataSource: { table }`), the same binding every data component takes. A way of looking at the records that should last — a filter, a sort, a grouping, a set of visible fields — is a view declared on the table, never something the grid carries or a reader saves. A grid does not switch to a board, a calendar or a gallery: those are separate `kanban`, `calendar` and `gallery` components, each with its own binding.

<!-- sovrium:options type:table depth=3 -->

`rowHeight` is `medium` by default, with `short` and `tall` on either side. `layout: fill` sizes the grid to a bounded parent and gives it the scroll — rows scroll inside the grid, the header row stays pinned, and the pager stays at the bottom edge. It needs an ancestor with a resolved height, and inside a tab panel it needs the tab set to declare `layout: fill` too, which this key cannot reach on its own. `toolbar` is a record of booleans selecting which controls appear: `search`, `filters`, `sort`, `export`, `refresh`. What a reader types in the search box, adds in the filter builder or picks in the sort builder narrows the rows for that visit only: it is stored nowhere, neither on the server nor in the browser, and a reload starts from the grid as configured.

## `onRowClick`

A row click accepts exactly two shapes: `{ type: navigate, path }`, which navigates with `$record.<field>` tokens replaced from the clicked row; and `{ action: openDrawer, component }`, which opens the sibling `drawer` with that `id` — note that `openDrawer` is keyed on `action`, not `type`.

Every other action type — `auth`, `crud`, `automation`, `filter`, `toast`, `fetch` — is **rejected** here, because a row click has never run them. Richer behaviour belongs on the opened drawer's own `actions`, where the full action set is available: open the record in a drawer, then act on it from there.

## `rowExpand`

Opening a row's full record is a property of the grid, so it needs no sibling component and no id to keep in step. `true` expands rows into a panel derived from the bound table; `false` is the same as omitting the key, so an expand can be switched off in place; an object of `{ fields, canEdit, title }` narrows the field list, makes the panel read-only and names it.

**With no `fields`, the panel shows every declared field of the bound table, in declared order** — not the visible `columns`. The reason to expand a row is to see what the row cannot show, so deriving from the columns would make expand a no-op on a grid that already displays everything. Each field keeps the `label` and `description` it declares. An explicit `fields` list narrows and reorders the panel, and may name a field that is not a column. Either way the panel follows its reader's field permissions: a field she may not read is not in it at all, and one she may read but not write shows its value without an editable control.

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

A field column's `format` chooses the cell rendering: `truncate`, `currency`, `percentage`, `compact`, `bytes`, `relative-date`, `relative-time`, `short-date`, `long-date`, `datetime`, `yes-no`, `check-cross`. `short-date` writes the day and the short month in the page language's order ("Sep 22", "22 sept."). The year is added only when the date falls in another year ("Mar 5, 2024"). `cellStyle` applies `{ when: { <operator>: value }, className }` rules per cell, over the operators `eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `lt`, `gte`, `lte`, and the presence flags `isEmpty: true` / `isNotEmpty: true`. An action's `visibleWhen` names a record `field` and takes the same operators, so `{ field: phone, isNotEmpty: true }` offers the action only on rows that have a phone number; a missing value, an empty text, an empty list and an empty object all count as empty.

A rule may name a `tone` instead of, or as well as, a `className`: `success`, `warning`, `error` or `muted`. A tone colours the cell's text **and** whatever the cell draws inside it, which a `className` on the cell cannot reach: the text of an option chip, a link, the text a formula spells. The chip's colour dot keeps its option colour. A rule with neither is refused.

A table's caption and its option chips take classes by part, `caption` and `chip`, through `classes`; `classes: { parts: { caption: sr-only } }` keeps a caption for screen readers only. A table written with `tableHeaders` and `tableRows` also takes `header` (each header cell), `row` (each body row) and `cell` (each body cell).

A written table draws each of its columns through `tableColumns`, in the order the headers declare: `align` (`left`, `center`, `right`) sets the alignment of the column's header and body cells, and `className` the classes of its body cells — `tableColumns: [{ className: font-mono }, {}, { align: right }]` sets the times of a booking sheet in the mono face and right-aligns its covers. A shorter list leaves the remaining columns as they are. `tableColumns` belongs to written tables only: declared beside a `dataSource` it is refused, as `tableRows` is.

`truncate: true` keeps a field column's cells on one line, cut with an ellipsis at the column's `width` (20rem when it declares none); the full value stays in the cell's tooltip. On an attachment column the file's icon stays on the line of its link. `badgeForm` sets how chips are drawn in that one column, overriding `design.badgeForm`: `filled`, `outline` (a neutral outlined chip, for a secondary column) or `outline-dot` (outlined, with a leading dot). On an option column — `single-select`, `multi-select` or `status` — each chip reads the option's `label`, a `$t:` key translated into the page language, and never the stored value; its colour is the option's. On a column holding text — a formula that spells a post's state — a `badgeForm` draws the value itself as a chip, and its colour is the matching `cellStyle` tone.

`valueLabels` renames values in one column — `{ draft: À relire }` — without changing the record or what the records API returns. On an option column the renamed value keeps its chip and the option's colour, and a value the map leaves out reads the option's own `label`.

A `url` field's cell is a link that opens in a new tab; a value that is not a web address is shown as text. A `date` field's cell reads as a calendar date in the page's language, on the same day for every reader. A `datetime` field's cell reads as its date and time in the page's language, at the wall clock of the field's own `timeZone`, else the operator time zone, whoever reads it; a field declaring `timeZone: local` reads at the reader's own clock. An attachment cell names each file as it was uploaded, as a link to it; the prefix that keeps the stored key unique is never shown.

```yaml
columns:
  - field: status
    frozen: true
    cellStyle: [{ when: { eq: overdue }, className: 'text-red-600' }]
  - field: due_date
    cellStyle: [{ when: { isEmpty: true }, className: 'text-muted-foreground' }]
  - type: actions
    actions: [{ label: Delete, action: { type: crud, operation: delete, table: tasks } }]
```

## Selection, grouping and summaries

`selection` takes a required `mode` — `none`, `single` or `multiple` — plus `showCheckboxes`. Each `bulkActions` entry is `{ label, icon, action, confirm }`, where `confirm` is the dialog wording and may contain `{count}`, replaced with the number of selected rows.

A grid is grouped by the view it binds. Grouping is declared on the table's view as `groupBy` — `field`, `direction` (`asc` by default), `collapsed`, and `thenBy`, up to two further levels nested inside the first, three in total — and the grid bound to that view with `dataSource.view` draws the groups. `summary` accepts `field`, `label` and `function`: one of `count`, `sum`, `avg`, `min`, `max`.

`direction` orders the group headers themselves, not the rows inside a group — those follow the view's `sorts` and the column headers. Grouping by a single-select or status field orders the headers by the field's **declared option order** rather than alphabetically, so a `stage` of `prospect`/`qualified`/`won` reads in the order it was authored. Each header also counts the whole result set: a group holding 30 records reads `(30)` even on a page showing 22 of them, and that holds at every level.

Every level answers for itself. `direction` applies per level and independently, `collapsed` is per level too, and folding nests. A field named by any level need not be a visible column; the header carries its value, which is often the reason to group by it. Naming the same field at two levels is refused at validation: every record in a group already shares the value that group was formed on, so a repeated level puts exactly one sub-group inside each group and partitions nothing.

Grouping by a relationship names each group by the related record, not by its key. When the relationship declares a `displayField` — or a grid column over that field names one — every group header at every level reads that label ("Acme Robotics (3)"), and `direction` orders the groups by it, alphabetically by the collation rules of the page's language — the one its cells are formatted in — so accented letters sort where a reader of that language expects them. A relationship that declares no label keeps its key in the header. The label only names the group: two related records that share a name stay two groups, each with its own count and totals. Grouping by a many-to-many relationship is not labelled.

**A declared `summary` describes the grid as a whole, and once the grid is grouped it additionally describes each group — at every level, not only the innermost.** There is no second option to turn this on. Because every level is summarised the figures reconcile: a `sum` over the sub-groups of one parent equals that parent's, and the parents' equal the footer's. Group totals stay visible when a group is collapsed, which is what makes collapsing everything a useful way to compare groups, and each is rendered in its column's `format`.

```yaml
tables:
  - name: deals
    # fields: name, region, stage, owner, value …
    views:
      - id: pipeline_by_region
        name: Pipeline by region
        groupBy:
          field: region
          direction: asc
          thenBy:
            - { field: stage, direction: desc }
            - { field: owner, collapsed: true }
pages:
  - name: pipeline
    path: /pipeline
    components:
      - type: table
        dataSource: { table: deals, view: pipeline_by_region }
        pagination: { pageSize: 25 }
        summary:
          - { field: name, function: count, label: Deals }
          - { field: value, function: sum, label: Pipeline value }
```

Regions read in their declared order, the stages inside each region read in reverse, and the owners inside each stage start folded. `owner` is not among the columns, and does not need to be.

**On a `dataSource.system` binding, a summary describes the rows the endpoint returned.** A grid bound to a table asks the database for its totals, so the footer answers for the whole collection whatever page you are on. A read endpoint answers with rows and no totals, so the figures are computed from the rows in hand — the grid asks for them without its own page window, keeping the same endpoint, static params, sort and search term. Two windows stay in place, because in both the narrowing is somebody's deliberate choice rather than the grid's paging: a `limit` the binding declares, and a feed walked by cursor. That is a real difference in what the number means: a `sum` under a table binding is the sum of everything, and under a system binding it is the sum of what came back. Empty cells are left out of both rather than counted as zero.

**Where a selection export gets its rows depends on the same binding.** A grid bound to a table sends the ticked ids to the records-export endpoint, so the file can carry rows from pages the browser never fetched, formatted as each column declares. A grid bound to a read endpoint has no table to address, so it writes the CSV itself — the rows it is holding, over the columns still on screen, with the values as the endpoint returned them — and names the file after the endpoint's last segment. Either way, a text cell that begins with `=`, `+`, `-`, `@`, a tab or a carriage return is written with a leading `'`, so a spreadsheet opening the file reads it as text rather than running it as a formula; number cells are written unchanged.

## Reading through a view

`dataSource.view` names one of the bound table's views by id or name. The grid reads through that view on the server and writes to the table's records: a reader the table lets write creates and edits records on the fields the view shows, while a reader without write access, and a visitor on a public view, get the grid read-only. It opens no live refresh. Bound to a public view, a page with no access rule shows the table to visitors who are not signed in. A `summary` row totals the rows the view returns — its filters included — rather than the whole table. Export stays off: the export reads the table, not the view, so it would hand a reader the fields and rows the view exists to withhold; bind the grid to the table with a filter where an export is needed.

The view owns the filter, the sort, the grouping and the visible fields, so a view-bound grid may not repeat them: a `dataSource.filter`, `dataSource.sort` or `dataSource.fields` beside `view` is refused when the config loads, with a message naming the view. What the grid keeps is how it draws the rows — its `columns`, `summary`, `pagination`, `rowHeight`. A reader's sort headers, search and filters still narrow the view for her visit, and never reach a column it leaves out. See the data binding article for an example.

## A grid that only reads

`readOnly: true` draws the grid as a reading for every reader, including one who may write the table: no New record, no Import, no add-row line and no in-cell editing, while search, sort, filters and export stay. Use it for a summary grid — the latest orders on a dashboard — whose rows are edited elsewhere. It changes only what the grid draws: the records API answers exactly as it would without it.

## On a phone

Below the `sm` breakpoint a grid scrolls sideways by default. `phoneLayout: rows` turns each row into a two-line item instead — the first column as its title, the next two beneath it — so a phone reader scans down rather than across. Wider screens always draw the grid.

## Account lists

`dataSource: { auth: apiKeys }` binds the grid to the reader's own API keys — `name`, `prefix`, `lastUsedAt` and `expiresAt`, never the key itself. `sessions` (`device`, `ipAddress`, `lastActiveAt`, `current`) and `passkeys` (`name`, `deviceType`, `createdAt`) are the reader's too; `members` (`name`, `email`, `image`, `role`, `joinedAt`) and the pending `invitations` (`email`, `role`, `invitedBy`, `sentAt`, `expiresAt`) need the reader to be allowed to administer accounts, and are left off the page for anyone else, and for a visitor who is not signed in. The server scopes every one of them, so no config can widen what a reader sees; each row also carries the `id` an account method targets.

An action column runs the item-level account methods on its row: `revokeApiKey`, `removePasskey`, `revokeSession`, `resendInvitation` and `revokeInvitation` act on `target: $record.id` when pressed (behind `confirm` when the item declares one), and the grid re-reads its rows once the server has accepted. `setRole` with an `editSelect` opens its role picker in the row when pressed, preset to the member's role, beside the button that saves it (its `saveLabel`); `renamePasskey` draws a "Passkey name" field open in the row, beside its button. Each row of the sessions list carries `data-session-current="true"` or `"false"`, so the session reading the page can be styled apart. A refusal is told as a toast — the action's `onError.toast` when it declares one, else the server's message.

## Pagination

`pagination` takes `pageSize` (25 by default), `pageSizeOptions` — the sizes the reader may pick —, `position` (`top`, `bottom` or `both`) and `style` (`numbered` or `loadMore`). No page size may exceed 100, the rows per page the records API serves: a larger `pageSize` or `pageSizeOptions` entry is refused at validation, naming the number and the ceiling, rather than failing the first time a reader picks it.

`dataSource.limit` caps how many rows the grid shows in all: a "latest drafts" grid with `limit: 5` asks for five rows, shows five, and draws no pager, since they fit on one page. With a `pageSize` smaller than the limit, each page holds `pageSize` rows and the pager counts no more than `limit`.

`style: numbered`, the default, draws page controls. `style: loadMore` draws one "Load more" button instead: each press fetches the next `pageSize` rows and appends them under the rows already shown, and the button disappears once every row is on screen. That grid shows no page-size selector and no page controls, and changing its sort, its filters or its search starts again from the first page. Its filters are applied by the server, so a match on a page not loaded yet is still found. Three limits apply: a filter row using `between`, `doesNotContain` or `isNoneOf` has no server spelling, so the whole filter panel then narrows only the rows already loaded and the footer totals no longer reflect it; the server compares `equals` with case, where a numbered grid filtering in the browser does not; and pages already shown are not refreshed by `refreshMode: poll` or `realtime` until the sort, filters or search change or the page reloads. There is no "show all": every request stays within the 100-row window, so a list of any length is reached one page at a time.

```yaml
- type: table
  dataSource: { table: candidatures }
  pagination: { pageSize: 100, style: loadMore }
```

## `rowColorField`

Names a field whose declared option colours fill each row. It is spelled `rowColorField` rather than `colorField` because a grid already decides colour per column, where a bare `colorField` would read as "colour the cells".

The fill comes from the option colours declared on the named field, and the row's text colour is derived from it so it stays legible against any hue. Unlike a calendar or timeline, **a grid invents nothing**: a value whose option declares no colour is not filled, and neither is an empty value or a grid with no `rowColorField` at all. There is no fallback palette.

**A filled row suppresses `striped`.** Striping, hover and selection are all painted as row backgrounds, and on a filled row the background belongs to you rather than to the grid's chrome — so a filled row drops all three and wears its selection and hover as inset shadows instead. The suppression is per row, not per grid.

A reader who may not read the named field sees the rows unfilled, and the page names neither the field nor its options.

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
