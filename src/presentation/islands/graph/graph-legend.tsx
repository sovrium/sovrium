/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The key mapping each shape to the node kind it stands for.
 *
 * ─── WHY `graph` HAS ONE WHERE `matrix` REFUSED ONE ────────────────────────
 *
 * `matrix` draws three glyphs from a CLOSED platform vocabulary, one of which
 * prints its own meaning, and its twin names every fact — so a legend there
 * would be prose explaining a figure that is `aria-hidden` half the time. A
 * graph's shape vocabulary is the BOUND ENDPOINT's and is open-ended: twelve
 * node kinds on the one shipped wire, each drawn as a generated polygon a
 * reader cannot decode from the drawing alone. Three marks can be learned from
 * the twin; twelve shapes cannot.
 *
 * ─── IT RENDERS INSIDE THE DRAWING, AND INHERITS ITS HIDDEN STATE ──────────
 *
 * The key sits inside `[data-graph-drawing]`, so when `label` is absent and the
 * drawing is `aria-hidden` the key is hidden with it. That is CONTAINMENT
 * rather than a silent no-op, and the user story argues it directly: a visual
 * key for a visual figure is correctly hidden alongside the figure it keys, and
 * it stays visible to a sighted reader in both of `label`'s states. The facts a
 * hidden key would have carried are in the twin, whose `Kind` column names
 * every kind as text.
 *
 * Its entries are DERIVED from the kinds actually drawn — never authored — so
 * it cannot show a shape the figure does not contain.
 */

import { polygonPoints } from '@/presentation/islands/graph/graph-shapes'
import type { GraphLegendEntryView } from '@/presentation/islands/graph/graph-island-types'
import type { ReactElement } from 'react'

/** The key's own glyph box. Smaller than a node's, and centred in it. */
const SWATCH = 16
const SWATCH_RADIUS = 6

export function GraphLegend({
  entries,
}: {
  readonly entries: readonly GraphLegendEntryView[]
}): ReactElement {
  return (
    <ul
      data-graph-legend=""
      className="text-foreground-subtle mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs"
    >
      {entries.map((entry) => (
        <li
          key={entry.kind}
          data-graph-legend-kind={entry.kind}
          className="flex items-center gap-1"
        >
          <svg
            width={SWATCH}
            height={SWATCH}
            viewBox={`0 0 ${String(SWATCH)} ${String(SWATCH)}`}
            className="text-foreground block"
          >
            <polygon
              points={polygonPoints(entry.shape, SWATCH_RADIUS)}
              transform={`translate(${String(SWATCH / 2)},${String(SWATCH / 2)})`}
              fill="currentColor"
            />
          </svg>
          {entry.kind}
        </li>
      ))}
    </ul>
  )
}
