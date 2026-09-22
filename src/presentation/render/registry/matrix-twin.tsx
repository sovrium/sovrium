/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `matrix` accessible twin — the PRIMARY artifact, not a fallback.
 *
 * A grid of glyphs is not accessible by itself, so shipping one is only
 * defensible if every fact it carries also exists as text. That is why nothing
 * in the schema can switch this table off, and why it renders whether the grid
 * is a NAMED FIGURE (`label` present, `role="img"`) or is `aria-hidden` — in the
 * second state it is the sole carrier, which is the reading an unnamed figure
 * announced as a figure would only add noise to.
 *
 * Its columns are a RENDERER CONSTANT — resource, grant source, operations,
 * flag — one row per POPULATED cell. An empty intersection gets no row: the
 * grid draws a cell for every pair, but a twin enumerating them all would read
 * as a list of permissions nobody has.
 *
 * ─── AND WHY IT IS A CELL ENUMERATION ──────────────────────────────────────
 *
 * The proposal gives the twin as "the field/row exception tables below it".
 * Those are NOT derivable from the shipped wire — the graph body carries no
 * field-permission and no row-predicate data on any node or edge — so the twin
 * enumerates what the wire actually carries. A named gap in the user story
 * rather than an omission here.
 *
 * ─── NO ACCESSIBLE NAME, DELIBERATELY ──────────────────────────────────────
 *
 * The table carries neither a `<caption>` nor an `aria-label`. `label` names the
 * FIGURE; repeating it here would announce the same words twice to a reader
 * moving from the drawing to the table, and the column headers already say what
 * each row is. A table with headers and no name is navigable; a table with two
 * names for one thing is not clearer for having them.
 *
 * Split from `matrix-component.tsx` so neither file carries two responsibilities
 * — and so neither approaches the 300-line React cap on its own growth.
 */

import type { MatrixTwinRowView } from '@/presentation/render/resolve/matrix-projection'
import type { ReactElement } from 'react'

const HEADER_CELL = 'border-b border-border py-1 pr-3 text-left font-medium text-foreground-subtle'
const BODY_CELL = 'border-b border-border py-1 pr-3 text-foreground'

/**
 * The twin's four column headings, in order.
 *
 * A list rather than four hand-written `<th>` elements, because they differed
 * only in their text and the repetition was most of the function's length.
 *
 * The last one is `Note`, NOT `Flag`. The column holds the author's own word
 * for a marked grant, and the reader meets that word as a remark about the row
 * rather than as the name of the mechanism that put it there — `flag` is the
 * schema's word for the OPTION, and printing it here is the option's vocabulary
 * leaking into an operator's table. Because the word is author-supplied the
 * heading cannot be specific either, so `Note` is the plainest true container
 * for whatever the configuration decided to say.
 */
const TWIN_HEADINGS = ['Resource', 'Grant source', 'Operations', 'Note'] as const

/**
 * Render the twin.
 *
 * The `flag` column is present on every row and EMPTY on an unflagged one: the
 * author's own word appears exactly once per flagged grant, never as a legend
 * and never repeated on a row that did not earn it.
 */
export function MatrixTwin({
  rows,
}: {
  readonly rows: readonly MatrixTwinRowView[]
}): ReactElement {
  return (
    <table
      data-matrix-twin=""
      className="mt-3 w-full border-collapse text-sm"
    >
      <thead>
        <tr className="text-xs">
          {TWIN_HEADINGS.map((heading) => (
            <th
              key={heading}
              scope="col"
              className={HEADER_CELL}
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.rowLabel}:${row.columnLabel}`}
            data-matrix-twin-row=""
          >
            <th
              scope="row"
              className={`${BODY_CELL} font-normal`}
            >
              {row.rowLabel}
            </th>
            <td className={BODY_CELL}>{row.columnLabel}</td>
            <td className={`${BODY_CELL} font-mono text-xs`}>{row.ops ?? ''}</td>
            <td className={BODY_CELL}>{row.flagLabel ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
