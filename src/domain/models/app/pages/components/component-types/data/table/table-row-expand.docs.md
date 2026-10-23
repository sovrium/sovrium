# Opening a Row Inline

> `rowExpand.placement: inline` — the row's record drawn as one full-width row directly under it, so the rest of the list stays in sight.

By default `rowExpand` opens the record in a panel beside the grid. A list read as a timeline — what happened to an app, a support thread, a run history — loses its point when the panel covers it. `placement: inline` draws the same record under the row instead, inside the table:

```yaml
- type: table
  dataSource: { table: events, refreshMode: poll }
  columns: [{ field: happened_at }, { field: title }, { field: status }]
  rowExpand:
    placement: inline
    fields: [report]
```

The inline row is the same record the panel would show: every declared field of the bound table, or the `fields` you list, with the same `canEdit` and `title`, under the same field permissions — a field the reader may not read is not drawn, and one she may read but not write shows its value without a control. It is drawn from the record the grid already holds, so expanding a row sends no request. Saving an edit made in it writes the record exactly as the panel does.

Each row gets a toggle button carrying `aria-expanded`; `Enter` and `Space` open and close it. The expanded row is a `row` with one cell spanning every column, so a screen reader keeps the table's structure.

`single` decides how many rows may be open at once. With `single: true` — the default — expanding a row closes the one already open; `single: false` lets several stay open. The drawer placement ignores it, since a panel shows one record at a time anyway.

Expanded rows survive a refresh. When a `poll` or `realtime` grid reads again, a row that is still on the page stays open with its fresh values; a row that left the page is no longer drawn. On a phone read as rows (`phoneLayout: rows`), the expanded record is drawn under its row's item.

Omitting `placement` changes nothing: `rowExpand` keeps opening the panel beside the grid.
