# Tables & Filter Bars

> The data grid — columns, selection, bulk actions, grouping and summaries — plus the filter-bar that narrows it and everything else listening on the same channel. Editing in the grid has its own page.

`table` is the grid. Bind it to a table or to a read endpoint with `dataSource`, or omit the binding and it draws the `tableHeaders` and `tableRows` you author; declaring both is refused. A table written with `tableHeaders` and `tableRows` draws shadcn/ui's Table, with its rows on whole pixels and its `caption` below it. Reference: shadcn/ui Table.

A grid binds either to one of the table's views (`dataSource: { table, view }`) or directly to the table (`dataSource: { table }`), the same binding every data component takes. A way of looking at the records that should last — a filter, a sort, a grouping, a set of visible fields — is a view declared on the table, never something the grid carries or a reader saves. A grid does not switch to a board, a calendar or a gallery: those are separate `kanban`, `event-calendar` and `gallery` components, each with its own binding.

<!-- sovrium:options type:table depth=3 -->

`rowHeight` is `medium` by default, with `short` and `tall` on either side. `layout: fill` sizes the grid to a bounded parent and gives it the scroll — rows scroll inside the grid, the header row stays pinned, and the pager stays at the bottom edge. It needs an ancestor with a resolved height, and inside a tab panel it needs the tab set to declare `layout: fill` too, which this key cannot reach on its own. A grid draws no controls of its own: the search box, the facets, the filter bar, Export and New are page components publishing on a shared-filter channel that the grid subscribes to with `dataSource.bindTo` and `sharedFilter: {}`, and the library block `block/data-table-toolbar` places the usual set above a grid in one entry. A `toolbar` or a `search` key on a `table` is refused at load, naming that replacement, and a refresh button becomes `dataSource.refreshMode`. What a reader types or picks in those controls narrows the rows for that visit only: it is stored nowhere, neither on the server nor in the browser, and a reload starts from the grid as configured. On a grid that loads page by page the narrowing is done by the server, so the matches are counted and paged from the first one. A grid wider than its container scrolls sideways under its first column, which stays pinned, at every screen width, with a shadow on its edge once the rows slide beneath it; columns the author pinned with `frozen` are pinned instead. A trailing action column stays pinned to the right edge, so its row menu is on screen however wide the grid is. While columns are still hidden past its right edge the grid casts a shadow there, gone once the reader has scrolled to the end. A cell too narrow for its value ends it with an ellipsis and names the whole value in a tooltip, whether it is pointed at or reached with the keyboard. An empty grid bound to a table that declares no `emptyMessage` names the table — `Suppliers has no records yet`, from its `labelPlural`, else its `label`, else its name made readable — and the controls the page composes above it stay where they are. A grid whose read fails names itself the same way — `Couldn’t load Suppliers.`, with a Retry, or `Suppliers isn’t available.` when the read is answered 404, which no retry can change — and a grid bound to a system endpoint rather than a table is named by its `props.aria-label`; a grid with neither says `Couldn’t load records.` A search that matches nothing says so with the `noMatchMessage`, never the empty message, and a grid whose endpoint does not search narrows the rows it holds by the term a search box publishes on its channel.

## `onRowClick`

A row click accepts exactly two shapes: `{ type: navigate, path }`, which navigates with `$record.<field>` tokens replaced from the clicked row; and `{ action: openSheet, component }`, which opens the sibling `sheet` with that `id` — note that `openSheet` is keyed on `action`, not `type`.

Every other action type — `auth`, `crud`, `automation`, `toast`, `fetch` — is **rejected** here, because a row click has never run them. Richer behaviour belongs on the opened drawer's own `actions`, where the full action set is available: open the record in a drawer, then act on it from there.

## `rowExpand`

Opening a row's full record is a property of the grid, so it needs no sibling component and no id to keep in step. `true` expands rows into a panel derived from the bound table; `false` is the same as omitting the key, so an expand can be switched off in place; an object of `{ fields, canEdit, title }` narrows the field list, makes the panel read-only and names it.

**With no `fields`, the panel shows every declared field of the bound table, in declared order** — not the visible `columns`. The reason to expand a row is to see what the row cannot show, so deriving from the columns would make expand a no-op on a grid that already displays everything. Each field keeps the `label` and `description` it declares. An explicit `fields` list narrows and reorders the panel, and may name a field that is not a column. Either way the panel follows its reader's field permissions: a field she may not read is not in it at all, and one she may read but not write shows its value without an editable control. A derived `rowExpand` shows a json field as a list of its keys, each key a term over its value, read-only.

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

**`rowExpand` is also refused on a grid bound to a read endpoint.** The panel derives its controls from the bound table's field schema, and a read endpoint has none. Use a `sheet` with `dataSource.system` and its own `recordFields`, opened with `onRowClick: { action: openSheet, component }`. That hand-wired form is unchanged and is not deprecated: `rowExpand` is a shorthand for the common case, not a replacement — the sheet can still bind a different table from the grid's, bind a read endpoint, be shared by two grids, and carry footer `actions`.

### What a click means

A row can carry several meanings at once. The **target** decides, never the timing. A click on an editable cell opens the cell editor on double-click and does not expand the record; on the selection checkbox it selects the row and nothing else; on a group header it folds or unfolds that group at any nesting level; on any other cell it expands the record.

Rows stay reachable from the keyboard: a row carrying an action is focusable and answers `Enter`, and no per-row button is added.

## `columns`

A column is either a **field column** or an **action column** (`type: actions`, carrying `actions`, each `{ label, action, icon, confirm, visibleWhen, disabledWhen, disabledReason, editSelect, variant }`; `disabledWhen` keeps an action drawn but disabled on the rows it matches, with `disabledReason` as its tooltip, or written under it in a menu — see the `button` component). An action's `variant` is its visual weight — `default`, `secondary`, `ghost` or `destructive` — and naming it is the only way to get one: omit it and the button paints as it always has, since a trigger opens a question and a column of red buttons makes the question look answered. A `confirm` prompt never implies `destructive`.

`rowActions.display` sets where a row's actions are drawn. `inline`, the default, keeps them a row of buttons. `menu` draws one `…` button per row, named after its column and its row ("Actions for Ada Lovelace": the column's `label`, else "Actions", and the value of the row's first field, else its position), that opens the row's actions as a dropdown menu: an action hidden by its `visibleWhen` is left out of that row's menu, a `destructive` action is a destructive item, and an `editSelect` action is a submenu whose choices mark the current value. A row has one menu: when the reader can see several action columns, their actions fill that one menu in column order, drawn in the place of the first column under the last one's `label`; a column a `capability` hides from the reader adds nothing. In both displays a `confirm` asks in a modal alert dialog over the page — named by its `title`, else its prompt — so the row never changes height while the question is open, and Cancel closes it without running the action. Its confirm button is red only for a destructive action — one that declares `variant: destructive`, or that deletes (a `DELETE` request, a `crud` delete); pausing, retrying or any other reversible action is confirmed with the default button. A `crud` action that carries its own `confirm: true` asks the same way, with its `confirmMessage` as the prompt (the page language's default prompt when it names none), in a row action, a bulk action and a record drawer's footer alike; the item's own `confirm` wins when both are set.

An action column also takes `capability`, which withholds the whole column — header included, and its action endpoints with it — from a caller who lacks the named power.

A cell with no value — absent, null or empty text — reads as a muted dash, whatever its `format`. A field column's `format` chooses the cell rendering: `truncate`, `currency`, `percentage`, `compact`, `bytes`, `duration`, `relative-date`, `relative-time`, `day-relative-time`, `short-date`, `long-date`, `datetime`, `time-ms`, `yes-no`, `check-cross`. `bytes` writes a size in binary units in the page language: `1.5 KB` on an English page, `1,5 ko` on a French one. `duration` writes an elapsed time as one compact figure — `180 ms`, `1.4 s`, `42 s`, `2 min 18 s`, `1 h 05 min` — with the page language's decimal separator; over a `duration` field it reads the field's stored seconds, over any other number it reads milliseconds, the unit an automation run's `durationMs` is kept in. `short-date` writes the day and the short month in the page language's order ("Sep 22", "22 sept."). The year is added only when the date falls in another year ("Mar 5, 2024"). `time-ms` writes the time of day to the millisecond, `14:03:07.512`, in the operator timezone — the precision a log or an event stream needs to order lines that land within the same second. `relative-time` reads in the largest whole unit — now, minutes, hours, yesterday/tomorrow, days. `day-relative-time` reads an instant the way a feed does, relative to the reader's day and with its time on a 24-hour clock — `Today 06:00`, `Yesterday 18:00` — then as the day and the short month with the time (`Oct 13, 07:30`, `13 oct., 07:30`), naming the year only when the instant falls in another year (`Dec 30, 2025, 09:15`); the day is the operator timezone's. `cellStyle` applies `{ when: { <operator>: value }, className }` rules per cell, over the operators `eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `lt`, `gte`, `lte`, and the presence flags `isEmpty: true` / `isNotEmpty: true`. An action's `visibleWhen` names a record `field` and takes the same operators, so `{ field: phone, isNotEmpty: true }` offers the action only on rows that have a phone number; a missing value, an empty text, an empty list and an empty object all count as empty.

A field column that names no `format` reads by its field type: an amount in the field's currency (a `formula` field declaring `format: currency` included), a percentage at its precision, a date, a timestamp (`created-at`, `updated-at` and `deleted-at` included) in the page language, an `email` or a `phone-number` as a link, an option as its chip. Every other value prints as stored, a number without grouping. A quantity column (`number`, `integer`, `decimal`, `currency`, `percentage`, `autonumber`, `count`, `duration`) aligns its header and its cells to the right, and quantities, dates and times are set in tabular figures — a date in the text face, never the monospace one; an authored `align` wins. An option with no `color` is drawn as a filled secondary badge, and `badgeForm: outline` keeps it outlined. A `single-line-text` reads as its text, a `long-text` in two lines with the whole text in its tooltip, a `signature` as who signed (`Signed by Camille Martin`). An AI field reads as the value it produces — a summary, a generated or translated text in two lines, a category as a chip, tags as chips, a sentiment as its label, an extraction as its JSON — followed by a small `AI` mark, so a reader can tell a value a model wrote. A column's heading is its own `label`, else the field's `label`, else the field name made readable: `unit_price` reads `Unit Price`.

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

`selection` takes a required `mode` — `none`, `single` or `multiple` — plus `showCheckboxes`. Each `bulkActions` entry is `{ label, icon, action, confirm }`. `confirm` is either the prompt itself, which may contain `{count}` (replaced with the number of selected rows) and is answered by a **Confirm** button, or an object `{ message, confirmLabel, cancelLabel }` whose two labels name the buttons — the same field names a row action's `confirm` object uses. A label left out keeps the default, read in the page's language. A bulk action sends **one request** for the whole selection, however many rows are selected, so deleting fifty rows spends one write of the reader's budget, not fifty. A row action that deletes takes its row out of the grid at once, and the grid re-reads the page once the deletes pause, so clearing rows one by one does not re-read the page after every delete. When a bulk action or a row action is refused because the reader's writes were too many, the grid shows a toast saying so and in how many seconds to retry, in the page's language, whatever `onError` declares; the rows, the selection and the buttons stay as they were. A delete button and a dialog's confirmed delete show the same toast. The grid's bottom bar carries the selection: while no row is checked its left half says where in the list the reader is, and once rows are checked that half reads `3 selected` followed by **Export selected**, **Delete** when the reader may delete the table's records — asking `Delete 3 records?` in the same row first — and the declared `bulkActions`. A `bulkActions` entry that already deletes replaces the built-in Delete rather than doubling it.

A grid is grouped by the view it binds. Grouping is declared on the table's view as `groupBy` — `field`, `direction` (`asc` by default), `collapsed`, and `thenBy`, up to two further levels nested inside the first, three in total — and the grid bound to that view with `dataSource.view` draws the groups. `summary` accepts `field`, `label` and `function`: one of `count`, `sum`, `avg`, `min`, `max`. A reader may still change three things for her visit from the right half of the bottom bar, none of them saved: **Group by** regroups the rows by a choice, checkbox, text, user or date column, or ungroups them; **Hide fields** hides columns, keeping at least one; **Row height** picks short, medium, tall or extra tall. A reload puts the grid back as configured.

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

`dataSource.view` names one of the bound table's views by id or name. The grid reads through that view on the server and writes to the table's records: a reader the table lets write creates and edits records on the fields the view shows, while a reader without write access, and a visitor on a public view, get the grid read-only. It opens no live refresh. Bound to a public view, a page with no access rule shows the table to visitors who are not signed in. A `summary` row totals the rows the view returns — its filters included — rather than the whole table. Export stays off: the export reads the table, not the view, so it would hand a reader the fields and rows the view exists to withhold; bind the grid to the table with a filter where an export is needed. A grid bound to a table that declares views draws a **Views** switcher above its rows: `All <plural>` first, then the views the reader may open, the `isDefault` one leading. The `All <plural>` entry is left out when one of the views the reader may open filters nothing — it declares no `filters`, or an empty `and` / `or` group — since that view already shows every row; a view whose conditions all rest on fields hidden from the reader is listed to that reader without them, and counts as filtering nothing. A grid that names no view opens on the table's `isDefault` view. Pressing one re-reads the rows through that view, for the visit only, and draws the view's `fields` as the grid's columns, in their order, grouped by its `groupBy`; `All <plural>` draws every column, ungrouped; a grid whose `publishes` declares `url: true` also writes the view into the address as `?view=`, and opens on the view such an address names.

The view owns the filter, the sort, the grouping and the visible fields, so a view-bound grid may not repeat them: a `dataSource.filter`, `dataSource.sort` or `dataSource.fields` beside `view` is refused when the config loads, with a message naming the view. What the grid keeps is how it draws the rows — its `columns`, `summary`, `pagination`, `rowHeight`. A reader's sort headers, search and filters still narrow the view for her visit, and never reach a column it leaves out. See the data binding article for an example.

## A grid that only reads

`readOnly: true` draws the grid as a reading for every reader, including one who may write the table: no add-row line and no in-cell editing, while sorting by a column stays. The controls composed above the grid are components of their own, which it does not hide. Use it for a summary grid — the latest orders on a dashboard — whose rows are edited elsewhere. It changes only what the grid draws: the records API answers exactly as it would without it.

## On a phone

Below the `sm` breakpoint a grid scrolls sideways by default. `phoneLayout: rows` turns each row into a two-line item instead — the first column as its title, the next two beneath it — so a phone reader scans down rather than across. On a grid that opens its rows (`onRowClick`), each item opens what its row opens, on a tap or from the keyboard. Wider screens always draw the grid. Below the `md` breakpoint (768px), a grid with somewhere to open a row — its `onRowClick`, else the first action-column item that only navigates (`type: fetch` with `mode: navigate`, and no `confirm`, `editSelect` or `visibleWhen`) — opens the row on a tap, and its action columns are not drawn: the actions stay reachable from what the row opens. A grid with nothing to open keeps its action column, reached by scrolling sideways.

## Account lists

`dataSource: { auth: apiKeys }` binds the grid to the reader's own API keys — `name`, `prefix`, `lastUsedAt` and `expiresAt`, never the key itself. `sessions` (`device`, `ipAddress`, `lastActiveAt`, `current`) and `passkeys` (`name`, `deviceType`, `createdAt`) are the reader's too; `members` (`name`, `email`, `image`, `role`, `joinedAt`) and the pending `invitations` (`email`, `role`, `invitedBy`, `sentAt`, `expiresAt`) need the reader to be allowed to administer accounts, and are left off the page for anyone else, and for a visitor who is not signed in. The server scopes every one of them, so no config can widen what a reader sees; each row also carries the `id` an account method targets.

An action column runs the item-level account methods on its row: `revokeApiKey`, `removePasskey`, `revokeSession`, `resendInvitation` and `revokeInvitation` act on `target: $record.id` when pressed (behind `confirm` when the item declares one), and the grid re-reads its rows once the server has accepted. `setRole` with an `editSelect` opens its role picker in the row when pressed, preset to the member's role, beside the button that saves it (its `saveLabel`); `renamePasskey` draws a "Passkey name" field open in the row, beside its button. Each row of the sessions list carries `data-session-current="true"` or `"false"`, so the session reading the page can be styled apart. A refusal is told as a toast — the action's `onError.toast` when it declares one, else the server's message.

## Pagination

`pagination` takes `pageSize` (25 by default), `pageSizeOptions` — the sizes the reader may pick —, `position` (`top`, `bottom` or `both`) and `style` (`numbered`, `loadMore` or `infinite`). No page size may exceed 100, the rows per page the records API serves: a larger `pageSize` or `pageSizeOptions` entry is refused at validation, naming the number and the ceiling, rather than failing the first time a reader picks it. A numbered pager steps to the first, previous, next and last page. The pager sits in the grid's 36px bottom bar, which is drawn whenever the grid numbers its pages or its rows can be checked. A bar that numbers no pages counts the rows instead, in the singular for one — `1 record`, `12 records` — and a grid bound to a system endpoint that answers a `resultSummary` phrase prints that phrase in its place, paged or not.

`dataSource.limit` caps how many rows the grid shows in all: a "latest drafts" grid with `limit: 5` asks for five rows, shows five, and draws no pager, since they fit on one page. With a `pageSize` smaller than the limit, each page holds `pageSize` rows and the pager counts no more than `limit`.

`style: numbered`, the default, draws page controls. `style: loadMore` draws one "Load more" button instead: each press fetches the next `pageSize` rows and appends them under the rows already shown, and the button disappears once every row is on screen. That grid shows no page-size selector and no page controls, and changing its sort, its filters or its search starts again from the first page. Its filters are applied by the server, so a match on a page not loaded yet is still found. Three limits apply: a filter row using `between`, `doesNotContain` or `isNoneOf` has no server spelling, so the whole filter panel then narrows only the rows already loaded and the footer totals no longer reflect it; the server compares `equals` with case, where a numbered grid filtering in the browser does not; and pages already shown are not refreshed by `refreshMode: poll` or `realtime` until the sort, filters or search change or the page reloads. There is no "show all": every request stays within the 100-row window, so a list of any length is reached one page at a time.

`style: infinite` loads the next page as the reader scrolls to the end of the rows, with the same rules as `loadMore`: no page controls, no page-size selector, a fresh start from the first page when the sort, the filters or the search change. The rows' body is marked busy while a page is on its way, and a polite status announces how many rows are loaded ("50 of 60 loaded"). A "Load more" button stays at the end of the rows for a reader without a pointer, and disappears with the last page. A row added while pages are loaded does not push a row already shown into the next page twice: the next page carries on from the last row loaded, and the count announced includes the new row. The footer's `summary` describes every row of the view, loaded or not.

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

One set of conditions, published to every data component listening on the same channel. Each condition reads as the field's label, a separator and the operator and value in a badge, with a button that lifts it; the add control opens the condition builder in a popover, and Escape closes it. Reference: shadcn/ui Data Table (its toolbar's faceted filter).

<!-- sovrium:options type:filter-bar depth=3 -->

Each entry of `fields` takes `name` — the column, as the subscribers' tables spell it — an optional `label`, an optional `kind`, and for `kind: select` an `options` list of `{ value, label }`. Each entry of `conditions` takes `field`, `operator` and `value`. `combinator` is `and` by default and the reader can change it once there are two conditions; `allowAdd` defaults to true, and off leaves existing chips removable. `fieldsFrom: { table }` offers one table's declared fields instead of writing them out — the bar's counterpart of a grid's `columnsFrom`: in declaration order, each field's kind and options derived from its type, a field the reader may not read left out; declare exactly one of `fields` and `fieldsFrom`. Under `fieldsFrom`, a many-to-one link is offered as a choice among the related table's rows, named by the link's `displayField` (the rows the reader may read, up to 100); a link of any other shape, which stores no column to compare, is left out. A date field also offers `is within` — the last 7 days, the last 30 days or the next 7 days, counted from the moment the condition is applied. `publishes.url: true` mirrors the bar's conditions in the page address, so a reload or a shared link opens with the same chips.

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

The operators are the ones the server can execute: `eq`, `neq`, `contains`, `gt`, `lt`, `gte`, `lte`, `in`, plus `starts with` for a text field and `between` for a number or a date, both ends included — what the grid's own filter builder offered. `kind` decides which of them a field offers and what control is drawn for the value — `text` gives is / is not / contains, `number` and `date` the comparisons, `select` is / is not / is any of. A `conditions` entry naming a field the bar does not offer in `fields` is **refused at boot**, by name, rather than published and quietly ignored.

A filter written into `dataSource.filter[]` is part of the binding: it is always applied and a reader cannot lift it. The bar's `conditions` are published on first render too — so a page can land already filtered — but each arrives as a chip the reader can remove.
