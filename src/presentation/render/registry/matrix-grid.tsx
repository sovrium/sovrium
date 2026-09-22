/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `matrix` DRAWING — the column strip, the banded rows, and the glyph in
 * each intersection.
 *
 * Split from `matrix-component.tsx` so that file exports only its renderer:
 * a module mixing a component export with a non-component one defeats fast
 * refresh, and the components here are the half that is genuinely reusable
 * between the grid and anything later drawn from the same view.
 *
 * ─── `label` IS THE ACCESSIBILITY SWITCH ───────────────────────────────────
 *
 * Present, the grid is `role="img"` carrying it as the accessible name — one
 * NAMED FIGURE instead of a table of marks with no text in it. Absent, the grid
 * is `aria-hidden`: an unnamed figure announced as a figure is noise, and
 * silence plus the real table beneath it is the better reading. The twin renders
 * either way, which is what makes the second state defensible at all.
 */

import type {
  MatrixCellView,
  MatrixColumnGroupView,
  MatrixGridView,
  MatrixRowGroupView,
} from '@/presentation/render/resolve/matrix-projection'
import type { ReactElement } from 'react'

const NOTICE_CLASS =
  'mb-2 rounded-md border border-error-border bg-error-bg px-3 py-2 text-sm text-error-fg'
// A column is as wide as its NAME, not as its mark.
//
// The cell only ever holds a glyph, so 32px was enough for everything the grid
// draws — and nothing it says. Measured on the console's own instance at that
// width: `member`, `viewer` and `Everyone` all truncated to about four
// characters, so three of the four column headings were unreadable and the two
// role columns were indistinguishable from each other. A matrix whose axes
// cannot be named is a wall of marks.
//
// 64px fits eight or nine characters at this step, which covers the grant-source
// names an app actually produces (`Everyone`, `workshop`, `member`). Anything
// longer still truncates and is recoverable two ways: the `title` below, and the
// accessible twin underneath, which spells every name out in full.
//
// The cell tracks the head because the two are flex columns in the same row and
// a head wider than its column would shear the grid.
// `text-center`, because the cell below it is `justify-center`. A left-aligned
// head over a centred mark reads as a half-column offset all the way down the
// grid — measured on the console's own instance, where the only populated
// column's glyphs sat visibly right of the word naming them.
const COLUMN_HEAD_CLASS = 'w-16 shrink-0 truncate text-center text-xs text-foreground-subtle'
const ROW_HEAD_CLASS = 'w-40 shrink-0 truncate text-sm text-foreground'
const CELL_CLASS = 'flex h-8 w-16 shrink-0 items-center justify-center'
const CORNER_LIT = 'h-1.5 w-1.5 bg-foreground'
const CORNER_UNLIT = 'h-1.5 w-1.5 bg-border'

/**
 * The mark a populated cell draws, chosen by the glyph the LADDER resolved —
 * never by the one declared. A cell with no glyph is an empty intersection and
 * draws nothing at all.
 */
function CellMark({ cell }: { readonly cell: MatrixCellView }): ReactElement | undefined {
  if (cell.glyph === undefined) return undefined
  if (cell.glyph === 'ops-label')
    return <span className="text-foreground font-mono text-xs">{cell.ops}</span>
  if (cell.glyph === 'filled') return <span className="bg-foreground h-3 w-3 rounded-xs" />
  return (
    <span className="grid grid-cols-2 gap-px">
      {(cell.corners ?? []).map((corner) => (
        <span
          key={corner.letter}
          className={corner.lit ? CORNER_LIT : CORNER_UNLIT}
        />
      ))}
    </span>
  )
}

/**
 * One intersection, populated or not.
 *
 * `data-matrix-glyph` names the glyph ACTUALLY drawn and is ABSENT on an empty
 * cell, which is what keeps "nothing is granted here" and "something is, drawn
 * some way" apart. The flag's word reaches a pointer as `title` and is
 * deliberately not text: the twin is where it is readable, and printing it here
 * as well would make a legend out of a mark and say it once per drawn cell.
 */
function MatrixCell({ cell }: { readonly cell: MatrixCellView }): ReactElement {
  return (
    <div
      data-matrix-cell={cell.key}
      className={CELL_CLASS}
      {...(cell.glyph === undefined ? {} : { 'data-matrix-glyph': cell.glyph })}
      {...(cell.ops === undefined ? {} : { 'data-matrix-ops': cell.ops })}
      {...(cell.flagged ? { 'data-matrix-flagged': 'true' } : {})}
      {...(cell.flagLabel === undefined ? {} : { title: cell.flagLabel })}
    >
      <CellMark cell={cell} />
    </div>
  )
}

/**
 * One band of rows sharing a `rows.groupBy` value.
 *
 * The band WRAPS the rows it holds rather than merely sitting above them, so a
 * re-order of the drawing keeps the grouping and a census of the bands counts
 * containers rather than captions. A row whose node does not carry the field
 * lands in an UNNAMED band, which carries no `data-matrix-row-group` at all:
 * an attribute naming nothing would count as a band in every such census.
 */
function MatrixGroup({ group }: { readonly group: MatrixRowGroupView }): ReactElement {
  return (
    <div {...(group.value === undefined ? {} : { 'data-matrix-row-group': group.value })}>
      {group.value === undefined ? undefined : (
        <div className="text-foreground-subtle mt-3 mb-2 text-xs">{group.value}</div>
      )}
      {group.rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-1"
        >
          <div
            data-matrix-row={row.id}
            className={ROW_HEAD_CLASS}
            // Same reason as the column head. A resource name is likelier to
            // overrun than a grant source's — a page path can be long — and a
            // row nobody can name is a row nobody can act on.
            title={row.label}
          >
            {row.label}
          </div>
          {row.cells.map((cell) => (
            <MatrixCell
              key={cell.key}
              cell={cell}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * One band of columns sharing a `columns.groupBy` value.
 *
 * The same two rules as {@link MatrixGroup} on the other axis: the band WRAPS
 * the heads it holds rather than captioning them from a distance, and an unnamed
 * band carries no `data-matrix-column-group`, so a census of the bands counts
 * only the ones that name something. An UNGROUPED axis is one unnamed band
 * holding every column, which is why this is the only path through the strip.
 *
 * The heads sit in their own flex row beneath the caption rather than beside it:
 * a caption in the same row would push its first head out of line with the cells
 * below it. That row repeats the strip's own `gap-1`, so two heads are the same
 * distance apart whether or not a band boundary falls between them — the grid
 * stays square and the banding is read from the captions, not from the spacing.
 */
function MatrixColumnBand({ group }: { readonly group: MatrixColumnGroupView }): ReactElement {
  return (
    <div {...(group.value === undefined ? {} : { 'data-matrix-column-group': group.value })}>
      {group.value === undefined ? undefined : (
        <div className="text-foreground-subtle mb-2 text-xs">{group.value}</div>
      )}
      <div className="flex items-center gap-1">
        {group.columns.map((column) => (
          <div
            key={column.id}
            data-matrix-column={column.id}
            className={COLUMN_HEAD_CLASS}
            // A truncated name with no way back to the whole one is a dead end
            // for a pointer user. The twin already spells it out for everyone
            // else, so this is the cheap half of a fix the page already has.
            title={column.label}
          >
            {column.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The drawing: a column header strip banded by `columns.groupBy`, then one band
 * per `rows.groupBy` value.
 *
 * The strip is `items-end` rather than `items-center` so every band's heads rest
 * on the same baseline whether or not the band above them carries a caption. On
 * an ungrouped axis, where no band does, it draws exactly what `items-center`
 * drew.
 */
export function MatrixGrid({
  view,
  label,
}: {
  readonly view: MatrixGridView
  readonly label: string | undefined
}): ReactElement {
  return (
    <div
      data-matrix-grid=""
      className="min-w-max"
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <div className="border-border flex items-end gap-1 border-b pb-2">
        <div className="w-40 shrink-0" />
        {view.columnGroups.map((group, index) => (
          <MatrixColumnBand
            key={group.value ?? `band-${String(index)}`}
            group={group}
          />
        ))}
      </div>
      {view.groups.map((group, index) => (
        <MatrixGroup
          key={group.value ?? `band-${String(index)}`}
          group={group}
        />
      ))}
    </div>
  )
}

/**
 * The one notice a matrix draws instead of, or beside, its grid.
 *
 * It carries `data-matrix-degraded` in BOTH of its readings — a read that
 * named an unresolved source, and a read that did not succeed at all — because
 * to an operator they are one sentence: part of this answer is missing, and the
 * calm empty grid you would otherwise see would be a lie.
 */
export function MatrixNotice({ message }: { readonly message: string }): ReactElement {
  return (
    <p
      data-matrix-degraded=""
      className={NOTICE_CLASS}
    >
      {message}
    </p>
  )
}
