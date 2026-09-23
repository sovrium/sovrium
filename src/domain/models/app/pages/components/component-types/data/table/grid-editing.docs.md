# Working in the Grid

> What a `table` with editable columns does without being configured — the cell cursor, ranges and the fill handle, the trailing row that creates records, and live refresh.

A grid with editable columns behaves like a spreadsheet. Nothing on this page is configured: it follows from a column being `editable`, and from the bound table's `canCreate` permission for the trailing row.

The whole grid is a single tab stop. Tab moves into it once, and from there the arrow keys move a cell cursor rather than walking every cell in the tab order. Arrow keys move one cell and cross read-only columns rather than skipping them; `Home` and `End` jump to the ends of the row; `PageUp` and `PageDown` move a viewport, landing on a real row; `Enter` commits an edit and drops the cursor one row, ready to retype a column; `Escape` cancels and keeps the cursor; `Tab` moves one cell along, wrapping to the next row at the row end. The cursor stops at every edge and never wraps around the grid. The grid announces itself with the `grid`, `row` and `gridcell` roles, and the cursor carries `aria-selected`.

Shift-clicking from the cursor extends the selection into a rectangle of cells, not a range of whole rows. The cursor cell carries a small square at its bottom-right corner — the fill handle — on an editable column only. Dragging it previews the span without writing anything; releasing writes one record per row in the span, and dragging sideways fills across columns, each destination coercing the value it receives. A value the destination column cannot hold is refused and named, and the rest of the fill still lands: dragging a word into a number column tells you which column refused it and what that column takes. Double-clicking the handle fills down to the end of the neighbouring column.

The last row of the body is a blank trailing row, below the data and above the summary. Typing into it and committing creates a record and grows a fresh trailing row underneath. `Escape` discards an unsaved trailing row and writes nothing; a commit missing a required field is refused, the column is named, and what was typed stays to be corrected. Grouping gives each group its own trailing row, prefilled with that group's value. The trailing row follows the same permission rule as the toolbar's create button: a role that may not create records gets no trailing row at all, rather than a disabled one.

**A grid does not refresh itself by default.** With no `refreshMode` declared on its `dataSource`, a change made elsewhere does not reach an open grid. `refreshMode: realtime` opens a live connection and applies changes as they arrive, and a connection stuck reconnecting says so in the grid rather than leaving a stale table looking current.

## Which cells are editable

A cell is editable when its column declares `editable: true`. A double-click opens the editor; a click on the selection checkbox selects the row instead, and a click on a group header folds that group — the **target** decides what a click means, never the timing.

An action column's `editSelect` is the inline dropdown a row editor offers for a choice column. It takes `options` or an `optionsSource` — the same table- or endpoint-backed binding a `select` component takes — and the two are mutually exclusive, with neither declared refused outright: a dropdown with nothing in it is not a useful control.
