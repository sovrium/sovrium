/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Frozen (pinned) columns.
 *
 * `columns[].frozen` says "pin this column to the left side of the table". It
 * used to reach the DOM as nothing but a `data-frozen="true"` attribute on the
 * `<th>`: no rule in the compiled stylesheet targeted it and no body cell
 * carried it at all, so a frozen column scrolled away exactly like every other
 * one — and the value slid out from under its own heading.
 *
 * Pinning is `position: sticky` on the cell, which needs a `left` offset. For
 * the first frozen column that is 0; for any after it, the offset is the summed
 * width of the frozen columns before it, and those widths are NOT known ahead of
 * layout (the grid is auto-layout — a column is as wide as its content makes
 * it). So they are measured from the rendered header row and re-measured
 * whenever a frozen header resizes.
 *
 * The offsets are keyed by FIELD rather than by index so a header cell and its
 * body cells resolve the same number without either knowing the other's
 * position.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT `columnPinningFeature` (re-measured 2026-09-03)
 * ---------------------------------------------------------------------------
 * A dependency-integration plan proposed deleting this module in favour of
 * TanStack v9's `columnPinningFeature`, on the stated grounds that the
 * hand-roll had no recorded reason. It has two, and neither has expired.
 *
 * 1. v9 COMPUTES NO OFFSETS. `column.getStart()` existed in v8 and is gone;
 *    grep `getStart` in `@tanstack/table-core` and it is absent. The feature
 *    exports `column_pin` / `getIsPinned` / `getCanPin` / `getPinnedIndex` and
 *    a family of `table_get{Start,Center,End}*` splitters — a STRUCTURAL model
 *    where the caller renders three regions. It hands back no `left` value, so
 *    registering it would delete none of the code below.
 *
 * 2. DECLARED WIDTHS ARE FICTION HERE. Even v8's `getStart()` summed
 *    `getSize()`, which reports the declared size — 150px for every column
 *    nobody resized. This grid is auto-layout, so a column is as wide as its
 *    content makes it, and pinning off declared sizes misplaces every column
 *    after the first. That is why the widths below are read back off the
 *    rendered header row instead.
 *
 * The contract to preserve is geometric, not structural: [internal ref]
 * / -063 and -FROZEN-REGRESSION assert that a frozen header and its body cells
 * hold their x within 1px while the rest of the grid scrolls away. No spec
 * asserts `position: sticky`, a `left` value or a z-index, so the mechanism is
 * free — but any replacement still has to produce the offsets v9 will not.
 */

import { useLayoutEffect, useState } from 'react'
import {
  computeTableFrozenCellClasses,
  computeTableTrailingPinCellClasses,
} from '@/presentation/design/table-default-classes'
import type { CSSProperties, RefObject } from 'react'

/** Sticky `left` offset in px, keyed by the frozen column's field name. */
export type FrozenOffsets = Readonly<Record<string, number>>

/** Shared empty map, so a grid with no frozen column allocates nothing. */
export const NO_FROZEN_OFFSETS: FrozenOffsets = {}

/**
 * The surface a pinned cell paints — its opaque fill and its leading edge
 * shadow — shared by the header and the body.
 *
 * Only the PIN stays inline below, because `left` is measured per column and a
 * measurement cannot be a class. Everything here is a design decision, so it
 * lives in the recipe where `app.design.*` can reach it. Both halves used to
 * carry a hand-written `backgroundColor`, and they had already drifted: the
 * header painted `--muted` and the body `--background`, so a pinned column
 * read as two different surfaces stacked on each other.
 */
export const FROZEN_CELL_CLASS = computeTableFrozenCellClasses()

/**
 * A frozen HEADER cell: pinned above the body cells. Both are sticky, and a
 * body cell scrolled up would otherwise cover the heading.
 */
export function frozenHeaderStyle(left: number): CSSProperties {
  return {
    position: 'sticky',
    left,
    zIndex: 3,
  }
}

/**
 * A frozen BODY cell: the same pin, one layer lower.
 *
 * The opacity that keeps the scrolling columns from reading through the pinned
 * values now arrives as {@link FROZEN_CELL_CLASS} rather than as an inline
 * `backgroundColor` — which is what lets a `rowColorField` fill still repaint
 * an unpinned cell while the pinned one holds the surface tone.
 */
export function frozenCellStyle(left: number): CSSProperties {
  return {
    position: 'sticky',
    left,
    zIndex: 2,
  }
}

/** The surface of the trailing action column while columns are clipped past it. */
export const TRAILING_PIN_CELL_CLASS = computeTableTrailingPinCellClasses()

/**
 * The trailing action column's pin: `right: 0`, so its row menu stays on screen
 * however wide the grid is. Inert while the grid fits its container — a sticky
 * cell only moves once there is something to scroll.
 */
export function trailingPinStyle(header: boolean): CSSProperties {
  return { position: 'sticky', right: 0, zIndex: header ? 3 : 2 }
}

/** Running total of the widths that precede each entry. */
function cumulativeOffsets(fields: readonly string[], widths: readonly number[]): FrozenOffsets {
  return Object.fromEntries(
    fields.map((field, index) => [field, widths.slice(0, index).reduce((sum, w) => sum + w, 0)])
  )
}

/** Same keys AND same numbers — lets the hook keep the previous object identity. */
function sameOffsets(a: FrozenOffsets, b: FrozenOffsets): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

/**
 * Measure the sticky `left` offset of every frozen column.
 *
 * Reads the rendered header row (`th[data-frozen]`, in column order) rather than
 * TanStack's `column.getSize()`, which reports the DECLARED size — 150px for
 * every column nobody resized — and would misplace the pins on an auto-layout
 * grid.
 *
 * Re-measures whenever a frozen header's own box changes: a window resize, a
 * drag on the resize handle, or a data change that re-flows the column.
 *
 * @param tableRef - the rendered `<table>` the frozen headers live in
 * @param frozenFields - frozen columns' field names, in column order
 */
export function useFrozenOffsets(
  tableRef: RefObject<HTMLTableElement | null>,
  frozenFields: readonly string[]
): FrozenOffsets {
  const [offsets, setOffsets] = useState<FrozenOffsets>(NO_FROZEN_OFFSETS)
  // A string key: `frozenFields` is rebuilt every render, so the array itself
  // would re-arm the effect on every render.
  //
  // The separator is NUL because a field name may legally contain a space, and
  // splitting on one would tear such a name in two. Write it as the `\0` ESCAPE,
  // never as a literal NUL byte: a raw one makes this file binary to git — no
  // textual diff, no three-way merge — and invisible to the repo's `grep`, which
  // skips non-text files. It sat here as a raw byte until 2026-09-03, and an
  // audit that grepped this file for its own rationale found nothing and
  // reported the rationale absent.
  const fieldKey = frozenFields.join('\0')

  useLayoutEffect(() => {
    const table = tableRef.current
    const fields = fieldKey.length > 0 ? fieldKey.split('\0') : []
    if (!table || fields.length === 0) return undefined

    const headers = [...table.querySelectorAll<HTMLElement>('thead th[data-frozen]')]
    const measure = (): void => {
      const widths = headers.map((header) => header.getBoundingClientRect().width)
      const next = cumulativeOffsets(fields, widths)
      setOffsets((previous) => (sameOffsets(previous, next) ? previous : next))
    }
    measure()

    // A single frozen column is pinned at 0 whatever its width, so there is
    // nothing to watch.
    if (fields.length < 2) return undefined
    const observer = new ResizeObserver(measure)
    headers.forEach((header) => observer.observe(header))
    return () => observer.disconnect()
  }, [tableRef, fieldKey])

  return offsets
}
