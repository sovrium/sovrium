/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import { useMemo } from 'react'
import {
  computeTableHeaderCellClasses,
  computeTableHeaderRowClasses,
  computeTableResizeHandleClasses,
  computeTableSortGlyphClasses,
  computeTableStickyHeaderClasses,
} from '@/presentation/design/table-default-classes'
import {
  FROZEN_CELL_CLASS,
  frozenHeaderStyle,
  NO_FROZEN_OFFSETS,
  type FrozenOffsets,
} from './frozen-columns'
import type {
  DataTableColumnMeta,
  DataTableHeader,
  DataTableHeaderGroup,
} from './island/table-features'
import type { CSSProperties, ReactElement } from 'react'

interface TableHeaderProps {
  readonly headerGroups: readonly DataTableHeaderGroup[]
  /** Measured sticky offsets for the pinned columns — see `frozen-columns.ts`. */
  readonly frozenOffsets?: FrozenOffsets
  /**
   * Pin the whole section to the top of the grid's scroll region — set only
   * under `layout: fill`, which is what creates a scroll region for it to pin
   * to. Left off, the column labels leave with the rows, which is what a grid
   * at its natural height has always done and what the page's own scroll makes
   * correct.
   *
   * The pin goes on the SECTION, not on its cells: the two pin on different
   * axes here (a frozen column pins sideways, the labels pin upward), and only
   * the section box moving is what keeps a measurement of the header agreeing
   * with where the header is painted.
   */
  readonly sticky?: boolean
}

/** Stops a synthetic event so a click on the resize handle does not bubble up
 *  to the `<th>` and trigger a column sort. */
const stopEvent = (event: React.SyntheticEvent) => event.stopPropagation()

type SortState = 'asc' | 'desc' | false

/**
 * Map the TanStack sort state to the `aria-sort` token — for a SORTABLE column.
 *
 * `undefined` for every other column, and the attribute is then not emitted at
 * all. `aria-sort` is WAI-ARIA's declaration that a column header can be
 * sorted, so putting `none` on a selection checkbox or an action cluster
 * promises assistive technology an ordering that nothing can deliver. It used
 * to sit on every `<th>` unconditionally.
 */
function ariaSortFor(
  canSort: boolean,
  sorted: SortState
): 'ascending' | 'descending' | 'none' | undefined {
  if (!canSort) return undefined
  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'
  return 'none'
}

/** The instruction a sort control gives, read off where the column is now. */
function sortActionLabel(sorted: SortState): string {
  if (sorted === 'asc') return 'Sort descending'
  if (sorted === 'desc') return 'Clear sort'
  return 'Sort ascending'
}

/**
 * Wrap the column's toggle so activating the BUTTON sorts exactly once.
 *
 * Built here, at module scope, rather than inline in the JSX below: the arrow
 * is then not created in the rendering scope, which is what `react-perf`'s
 * `jsx-no-new-function-as-prop` is measuring. A `useCallback` would not do — the
 * toggle it closes over is a fresh function on every render, so the memo would
 * never hold and the hook would only be there to quiet the rule.
 */
function buildSortClick(
  toggle: ((event: unknown) => void) | undefined
): (event: React.MouseEvent<HTMLButtonElement>) => void {
  return (event) => {
    event.stopPropagation()
    toggle?.(event)
  }
}

/**
 * Enter or Space on a focused column header sorts it, exactly as a click does.
 *
 * It routes through the SAME `getToggleSortingHandler` the `<th>`'s `onClick`
 * already holds, so the keyboard cannot drift from the pointer: one gesture,
 * one cycle, one place to change it. `shiftKey` reaches the handler intact, so
 * multi-sort works from the keyboard on the grids that allow it.
 *
 * `preventDefault` is what keeps Space from scrolling the page out from under a
 * reader who just pressed it, and the `target !== currentTarget` guard keeps a
 * key pressed inside the header — the resize handle, a future control — from
 * bubbling up and sorting as well. Same guard, same reason, as the row action's
 * in `data-row.tsx`.
 *
 * Module scope, like `buildSortClick` above and for the same reason: the arrow
 * is then not created in the rendering scope, which is what `react-perf`'s
 * `jsx-no-new-function-as-prop` measures.
 */
function buildSortKeyDown(
  toggle: ((event: unknown) => void) | undefined
): (event: React.KeyboardEvent<HTMLTableCellElement>) => void {
  return (event) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggle?.(event)
  }
}

/**
 * Sort-direction indicator. `aria-hidden` keeps the accessible name of the
 * columnheader stable (`priority`, not `priority ↑`) so
 * `page.getByRole('columnheader', { name: 'priority' })` still resolves after
 * a sort click. The aria-label sits on the span for spec locators that look up
 * the indicator inside the header. Returns `undefined` when unsorted.
 */
function SortIndicator({ sorted }: { readonly sorted: SortState }): ReactElement | undefined {
  if (sorted === 'asc') {
    return (
      <span
        aria-label="sorted ascending"
        aria-hidden="true"
        className={`sort-asc ${computeTableSortGlyphClasses({ active: true })}`}
      >
        ↑
      </span>
    )
  }
  if (sorted === 'desc') {
    return (
      <span
        aria-label="sorted descending"
        aria-hidden="true"
        className={`sort-desc ${computeTableSortGlyphClasses({ active: true })}`}
      >
        ↓
      </span>
    )
  }
  return undefined
}

/**
 * The glyph a SORTABLE column always shows: its direction once sorted, and the
 * double arrow at rest.
 *
 * The resting glyph is new, and it is the affordance rather than decoration —
 * the sort control has to have a box for a pointer to reach and for a reader to
 * see, and `SortIndicator` draws nothing until a sort exists. `active: false`
 * is the tone the design system already minted for exactly this: "it exists so
 * a caller that DOES draw an inactive affordance has the disabled tone to hand
 * rather than minting one" (`table-shell-default-classes.ts`).
 *
 * `aria-hidden`, like its sorted siblings — the button around it is what
 * carries a name.
 */
function SortGlyph({ sorted }: { readonly sorted: SortState }): ReactElement {
  return (
    SortIndicator({ sorted }) ?? (
      <span
        aria-hidden="true"
        className={computeTableSortGlyphClasses({ active: false })}
      >
        ↕
      </span>
    )
  )
}

/**
 * Resize handle: an absolutely-positioned `<div>` on the right edge of the
 * header cell. It exposes `data-resize-handle` AND the `resize-handle` class so
 * spec locators (`locator('.resize-handle, [data-resize-handle]')`) resolve.
 * `onMouseDown` is wired to TanStack Table's `header.getResizeHandler()` —
 * pointer dragging then drives the controlled `columnSizing` state which the
 * orchestrator persists to user preferences. Returns `undefined` when the
 * column is not resizable.
 */
function ResizeHandle({ header }: { readonly header: DataTableHeader }): ReactElement | undefined {
  if (!header.column.getCanResize()) return undefined
  return (
    <div
      data-resize-handle
      // A 4px hit-area on the right edge of the header. Width must be large
      // enough for Playwright's `hover()` visibility check to pass (zero-area
      // divs are treated as invisible); the recipe's `opacity-0` does not
      // affect that check, which reads the box, not the paint.
      className={computeTableResizeHandleClasses()}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={stopEvent}
    />
  )
}

/**
 * The inline style a header cell wears: an explicit width when the USER resized
 * it, and the sticky pin when the column is frozen. `undefined` (the common
 * case) leaves the cell on the table's own auto layout with no style attribute.
 */
function headerCellStyle(
  meta: DataTableColumnMeta | undefined,
  frozenOffsets: FrozenOffsets,
  width: number | undefined
): CSSProperties | undefined {
  const sizing = width === undefined ? undefined : { width, minWidth: width }
  if (meta?.frozen !== true) return sizing
  return { ...sizing, ...frozenHeaderStyle(frozenOffsets[meta.field ?? ''] ?? 0) }
}

/**
 * The column label, and — where the column can be sorted — the control that
 * sorts it.
 *
 * The `<th>` has carried `onClick` since the grid shipped, so a reader could
 * always sort by clicking anywhere in the header — but nothing SAID so. A column
 * announced sortable through `aria-sort` offered a sighted reader no mark to aim
 * at and no cursor change to discover. The glyph button is that mark.
 *
 * ─── IT IS DELIBERATELY OUT OF THE ACCESSIBILITY TREE ─────────────────────
 *
 * `aria-hidden` with `tabIndex={-1}`: the control is redundant with the `<th>`
 * that contains it, and a redundant control that duplicates its container's
 * action is exactly what `aria-hidden` is for. No focusable element is hidden,
 * so the usual prohibition does not apply.
 *
 * It is not squeamishness. A `columnheader`'s accessible name is computed from
 * its CONTENTS, so ANY name this button carries becomes part of the column's,
 * and three spellings were measured against the suite before this one:
 *
 * - Button wrapping the label, named `Sort ascending` — renamed every column
 *   header in every grid after the action. 22 tests, and a screen-reader user
 *   heard the action where the field name belongs.
 * - Button wrapping the label, unnamed, with `aria-label` on the `<th>` — the
 *   W3C pattern plus an explicit header name. A button field draws a `Ship`
 *   button in every row and names its column `Ship`, so the header grew a second
 *   `Ship` button doing something else entirely; and the `<th>`'s `aria-label`
 *   is what `getByLabel('Name')` reads, so a grid beside a form began answering
 *   to the form's field names.
 * - Label outside, button named after the action — the header's name became
 *   `name Sort ascending`. Substring lookups survived that; an ANCHORED one
 *   (`{ name: /^name$/i }`) did not, and a column header whose name is not its
 *   column is wrong whether or not a test notices.
 *
 * Contributing NO name is the only spelling under which a column header is still
 * named exactly after its column. The accessibility tree is byte-identical to
 * what it was before this control existed.
 *
 * What that left open was the KEYBOARD, and it had been open since the grid
 * shipped: a `<th>` is not focusable and takes no Enter, so a column announced
 * sortable was never sortable without a pointer. Naming this button would not
 * have fixed it — the fix is a focusable HEADER, and `HeaderCell` below is where
 * it lives: a sortable `<th>` carries `tabIndex={0}` and answers Enter or Space
 * through the same toggle its `onClick` holds. `tabIndex` contributes no
 * accessible name, so the header is still named exactly after its column and
 * this control can stay out of the tree.
 *
 * `onClick` stops propagating before invoking the same handler the `<th>` holds,
 * so a press fires exactly once whether it lands on the glyph or on the padding
 * beside the label.
 */
function HeaderLabel({ header }: { readonly header: DataTableHeader }): ReactElement {
  const sorted = header.column.getIsSorted()
  const label = header.isPlaceholder
    ? undefined
    : flexRender(header.column.columnDef.header, header.getContext())
  if (!header.column.getCanSort()) {
    return <div className="flex items-center gap-1">{label}</div>
  }
  const action = sortActionLabel(sorted)
  return (
    <div className="flex items-center gap-1">
      {label}
      <button
        type="button"
        data-sort-control="true"
        aria-hidden="true"
        tabIndex={-1}
        title={action}
        className="inline-flex cursor-pointer items-center"
        onClick={buildSortClick(header.column.getToggleSortingHandler())}
      >
        <SortGlyph sorted={sorted} />
      </button>
    </div>
  )
}

/** Renders a single header cell with sort indicator + resize handle. */
function HeaderCell({
  header,
  frozenOffsets,
}: {
  readonly header: DataTableHeader
  readonly frozenOffsets: FrozenOffsets
}) {
  const { meta } = header.column.columnDef
  // Apply an inline width when the READER has resized this column, and
  // otherwise when the CONFIG declared one. A column that has neither gets no
  // width at all and stays on the table's auto layout, which is the natural
  // case and what every other data-table test measures.
  //
  // The reader wins over the config: a drag is the more recent instruction, and
  // `getSize()` already reports the dragged width once `columnSizing` holds an
  // entry. It cannot stand in for the config width, though — TanStack merges a
  // 150px default into every column def, so `getSize()` on an unauthored column
  // reports a number nobody asked for. `meta.authoredWidth` is present only
  // when the column really declared one.
  //
  // `HeaderContext.table` is the CORE table, which carries `atoms` but not the
  // React wrapper's `.state` — so the slice is read off its atom directly.
  const columnSizing = header.getContext().table.atoms.columnSizing.get()
  const userResized = columnSizing[header.column.id] !== undefined
  const width = userResized ? header.getSize() : meta?.authoredWidth
  // A frozen header is PINNED: it stays at its own left offset while the rest of
  // the row scrolls underneath it. `data-frozen` alone never did that.
  const cellStyle = useMemo(
    () => headerCellStyle(meta, frozenOffsets, width),
    [meta, frozenOffsets, width]
  )
  const canSort = header.column.getCanSort()
  return (
    <th
      key={header.id}
      // `cellClass` deliberately does NOT reach here any more. It is the BODY's
      // density map, and interpolating it grew the column labels' padding
      // whenever the reader asked for taller rows. A header's padding is a
      // constant of the design; the recipe owns it.
      className={`${computeTableHeaderCellClasses()} relative ${
        canSort ? 'cursor-pointer select-none' : ''
      } ${meta?.frozen === true ? FROZEN_CELL_CLASS : ''}`}
      {...(cellStyle && { style: cellStyle })}
      onClick={header.column.getToggleSortingHandler()}
      aria-sort={ariaSortFor(canSort, header.column.getIsSorted())}
      {...(meta?.frozen && { 'data-frozen': 'true' })}
      {...(canSort && {
        tabIndex: 0,
        onKeyDown: buildSortKeyDown(header.column.getToggleSortingHandler()),
      })}
    >
      <HeaderLabel header={header} />
      <ResizeHandle header={header} />
    </th>
  )
}

/**
 * Renders the table header with sortable columns
 */
export function TableHeader({
  headerGroups,
  frozenOffsets = NO_FROZEN_OFFSETS,
  sticky = false,
}: TableHeaderProps): ReactElement {
  return (
    <thead
      className={`${computeTableHeaderRowClasses()}${
        sticky ? ` ${computeTableStickyHeaderClasses()}` : ''
      }`}
    >
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              frozenOffsets={frozenOffsets}
            />
          ))}
        </tr>
      ))}
    </thead>
  )
}
