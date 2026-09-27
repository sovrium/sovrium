# Data-dense surfaces

Operate surfaces — record lists, queues, dashboards — are used many times a day by the same
people. They reward predictability over novelty and density over whitespace. This file gives the
anatomy of a resource index, the rules for filtering, and the rules for tables.

## Contents

- [Resource index anatomy](#resource-index-anatomy)
- [Search and filtering](#search-and-filtering)
- [Tables](#tables)
- [Bulk actions](#bulk-actions)
- [Dashboards and numbers](#dashboards-and-numbers)
- [Checklist](#checklist)

## Resource index anatomy

A resource index is the page that lists one kind of record so the visitor can find one, act on
several, or add another. Build it from these parts, top to bottom, and omit a part only for a
stated reason:

1. **Page heading** naming the resource in the plural, and the primary action beside it ("New invoice").
2. **Views or tabs** for the few saved subsets the visitor switches between daily ("Open", "Overdue", "All"), if the app has them.
3. **Search** across the fields a visitor would type from memory.
4. **Filters** for the fields a visitor narrows by (status, owner, date range).
5. **Sort** control, with one sensible default.
6. **The list or table** itself, with a selection column when bulk actions exist.
7. **Contextual action bar** that replaces or overlays the toolbar while rows are selected, showing the count and the bulk actions.
8. **Pagination** once the list can exceed roughly 50 items, showing the range ("51–100 of 1,240").
9. **Empty states** for first use and for no results (`states-and-forms.md`).

- On small screens, collapse low-priority columns into the row or a detail view rather than scrolling horizontally; keep the identifying column and the primary status.
- Clicking a row opens the record; row-level controls do not steal that click.
- Destructive actions always confirm, naming the count; a toast confirms completion and offers undo when possible.
- Tables, filter bars, selection, pagination, toolbars, bulk actions and views: `sovrium docs data-components/data-components`.

## Search and filtering

- Search is one box, placeholder naming what it searches ("Search by name or email").
- A no-results search echoes the query and offers to clear it.
- Choose the filter commit mode by cost:
  - **Instant** (results update as each filter changes) when results return fast and filters are few.
  - **Batch** (an "Apply" button) when each query is slow or the visitor sets several filters at once.
- Show the active filters as removable chips or a count on the filter control ("Filters · 3").
- Offer "Clear all" whenever any filter is active.
- Filters and search combine; say so by keeping both visible.
- Where the component supports it, keep the visitor's filters and sort in the URL, so a filtered view can be shared and survives a reload.
- Put the most used filters in view and the rest behind "More filters".

## Tables

- Right-align numbers, and use tabular (fixed-width) numerals so digits line up down the column.
- Left-align text; align a column's header the same way as its content.
- Keep one default sort, visibly marked on its column, usually the field the visitor scans by (most recent, or due date).
- Truncate long text with an ellipsis and full text on hover or in the detail view; never wrap an identifier across lines.
- Show units in the header ("Amount (EUR)"), not in every cell.
- Represent empty cells consistently (a dash or blank), never "null" or "undefined".
- Offer density by content, not by fashion:

| Density     | Use when                                                   |
| ----------- | ---------------------------------------------------------- |
| Compact     | Many rows of short values scanned together (logs, ledgers) |
| Default     | Mixed content, the everyday case                           |
| Comfortable | Few rows with rich content (avatars, two-line cells)       |

- Use the app's density ladder rather than hand-set padding: `sovrium docs theming/design-density`.
- One row action inline (the most common one); several row actions go in an overflow menu at the row's end.
- Keep the header row visible when the table scrolls.
- Status colours come from the author's option colours; chrome (selection, hover, focus) stays neutral.
- Every table declares its empty and no-match messages.
- Inline editing and keyboard navigation in the grid: `sovrium docs data-components/data-components-grid-editing`.

## Bulk actions

- Selection checkbox in the first column; the header checkbox has three states: none, some (indeterminate), all on this page.
- When all rows on a page are selected and more exist, offer "Select all 1,240" explicitly.
- The action bar states the count ("12 selected") and lists only the actions that apply to every selected row.
- Destructive bulk actions confirm with the count and the consequence.
- After a bulk action, clear the selection and confirm the result, including partial failures ("10 archived, 2 could not be archived").

## Dashboards and numbers

- Lead with the few numbers the visitor acts on; everything else is one click deeper.
- Each `kpi` shows the value, its unit, the period, and a comparison only if the comparison is meaningful.
- Label periods explicitly ("Last 30 days"), never "Recent".
- Charts: one message per chart, a title that states it, axes labelled with units, and the data colours the author declared.
- Loading dashboards use skeletons that match each tile's shape.
- KPI and chart options: `sovrium docs data-components/data-components-kpis` and `sovrium docs data-components/data-components-charts`.

## Checklist

- [ ] Heading plus one primary action.
- [ ] Search, filters (instant or batch, chosen by cost), sort with a default.
- [ ] Active-filter count and "Clear all".
- [ ] Selection with three header states and a contextual action bar.
- [ ] Pagination above about 50 items, showing the range.
- [ ] Numbers right-aligned with tabular numerals; units in headers.
- [ ] One inline row action; the rest in an overflow menu.
- [ ] Density chosen by content from the app's ladder.
- [ ] Low-priority columns collapse on small screens.
- [ ] Destructive actions confirm with a count; completion confirmed with a toast.
- [ ] Empty and no-match states declared.
