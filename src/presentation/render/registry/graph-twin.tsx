/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `graph` accessible twin — the PRIMARY artifact, not a fallback.
 *
 * A node-link diagram is not accessible by itself, so shipping one is only
 * defensible if every fact it carries also exists as text. That is why nothing
 * in the schema can switch this table off, and why it renders whether the
 * drawing is a NAMED FIGURE (`label` present, `role="img"`) or is `aria-hidden`
 * — in the second state it is the sole carrier.
 *
 * ─── IT IS SERVER-RENDERED, AND IT SITS OUTSIDE THE ISLAND ─────────────────
 *
 * The drawing hydrates; this does not. An island REPLACES its own mount root on
 * mount, so a twin rendered inside that root would have to be painted a second
 * time by the island — and two paints of one thing across the SSR/island
 * boundary drift silently, which is the failure the split exists to prevent.
 * One paint, on the server, never replaced. It is also what puts every fact in
 * the FIRST response, for a reader with no scripting and for a crawler.
 *
 * ─── ONE ROW PER DRAWN NODE, AND `reaches` IS THE EDGES AS TEXT ────────────
 *
 * `matrix`'s twin enumerates POPULATED CELLS, because a matrix's facts live in
 * its intersections. A graph's facts live in its NODES and the edges leaving
 * them, so this enumerates nodes — each naming its kind, the column it sits in,
 * the band it fell into, and the nodes it reaches directly. The reach column is
 * what makes the edges readable without seeing a line.
 *
 * DIRECT successors, not the transitive closure: the transitive set is the
 * island's reach HIGHLIGHT, which is a rendering decision and deliberately
 * crosses nothing.
 *
 * ─── NO ACCESSIBLE NAME, DELIBERATELY ──────────────────────────────────────
 *
 * The table carries neither a `<caption>` nor an `aria-label`, exactly as
 * `matrix`'s twin does and for the same reason: `label` names the FIGURE, and
 * repeating it here would announce the same words twice to a reader moving from
 * the drawing to the table. The column headers already say what each row is.
 *
 * @see src/presentation/render/registry/matrix-twin.tsx — the same contract on the other lens
 */

import type { GraphTwinRowView } from '@/presentation/render/resolve/graph-projection'
import type { ReactElement } from 'react'

const HEADER_CELL = 'border-b border-border py-1 pr-3 text-left font-medium text-foreground-subtle'
const BODY_CELL = 'border-b border-border py-1 pr-3 text-foreground'

/**
 * The twin's six column headings, in order.
 *
 * The first four are the user story's own enumeration — a drawn node's name,
 * its kind, the column it sits in, and the nodes it reaches. `Group` carries
 * the band a `groupBy` column put it in, and is present-and-empty on an
 * ungrouped row rather than absent, so every row has the same shape. `Detail`
 * carries the wire's own one-line `detail`, which the drawing shows only as a
 * pointer `<title>` — so the twin carries strictly MORE than the figure, which
 * is the direction the asymmetry has to run.
 */
const TWIN_HEADINGS = ['Node', 'Kind', 'Column', 'Group', 'Detail', 'Reaches'] as const

/**
 * Render the twin.
 *
 * Each row is `tabIndex={0}`, which is what makes "every twin row is
 * keyboard-reachable" literally true rather than true-by-interpretation. A
 * `<tr>` is not focusable by default, and a twin whose rows a keyboard user
 * cannot land on is a table they have to read with a screen reader or not at
 * all — which would leave the sighted keyboard user, who can see the drawing
 * but cannot select in it, with nothing.
 */
export function GraphTwin({ rows }: { readonly rows: readonly GraphTwinRowView[] }): ReactElement {
  return (
    <table
      data-graph-twin=""
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
            key={row.id}
            data-graph-twin-row={row.id}
            tabIndex={0}
          >
            <th
              scope="row"
              className={`${BODY_CELL} font-normal`}
            >
              {row.label}
            </th>
            <td className={`${BODY_CELL} font-mono text-xs`}>{row.kind}</td>
            <td className={BODY_CELL}>{row.columnLabel}</td>
            <td className={BODY_CELL}>{row.band ?? ''}</td>
            <td className={BODY_CELL}>{row.detail ?? ''}</td>
            <td className={BODY_CELL}>{row.reaches.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
