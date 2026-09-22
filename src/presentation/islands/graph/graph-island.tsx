/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `graph` island — the DRAWING, and nothing else.
 *
 * ─── IT FETCHES NOTHING ────────────────────────────────────────────────────
 *
 * This is the one thing that separates it from `chart` and `kpi`, which both
 * mount and then read. The graph's endpoint was already read on the RENDER path
 * by `graph-resolver.ts`, with the caller's own borrowed credentials, and the
 * projection crossed as `data-island-props`. Three things follow: the
 * accessible twin is in the first response rather than after a round trip, the
 * read carries the visitor's identity rather than the browser's ambient one
 * (rule S1), and a page drawing two lenses over one endpoint pays one read.
 *
 * So the island's whole job is what cannot be done before delivery: compute the
 * geometry, draw it, and let a reader select a node and see what it reaches.
 *
 * ─── WHAT IT DOES *NOT* RENDER ─────────────────────────────────────────────
 *
 * The accessible twin, the degraded notice and the empty state are all
 * server-rendered by `island-graph-component.tsx`, and the twin deliberately
 * sits OUTSIDE this island's mount root — an island replaces its own root, so a
 * twin inside it would be painted twice across the SSR boundary and the two
 * paints would drift silently. This component never sees them.
 *
 * @see src/presentation/render/registry/island-graph-component.tsx — the server half
 * @see ./graph-layout.ts — the geometry, computed and never simulated
 */

import { useMemo } from 'react'
import { GraphDrawing } from '@/presentation/islands/graph/graph-drawing'
import { GraphLanesDrawing } from '@/presentation/islands/graph/graph-lanes-drawing'
import { layOutGraphLanes } from '@/presentation/islands/graph/graph-lanes-layout'
import { layOutGraph } from '@/presentation/islands/graph/graph-layout'
import { GraphLegend } from '@/presentation/islands/graph/graph-legend'
import { useGraphSelection } from '@/presentation/islands/graph/use-graph-selection'
import type {
  GraphColumnView,
  GraphEdgeView,
  GraphIslandProps,
  GraphLanesView,
  GraphLegendEntryView,
  GraphReach,
} from '@/presentation/islands/graph/graph-island-types'
import type { GraphSelectionState } from '@/presentation/islands/graph/use-graph-selection'
import type { ReactElement } from 'react'

/** What `reach` means when `selection` declared none. */
const DEFAULT_REACH: GraphReach = 'downstream'

/**
 * Stable empty collections.
 *
 * Hoisted to module scope so a props bag missing a key does not allocate a new
 * array on every render — which would change the identity `useMemo` keys off
 * and re-lay-out a 58-node drawing for nothing. (`react-perf` flags the same
 * shape inside JSX; the reason it matters here is the memo, not the rule.)
 */
const NO_COLUMNS: readonly GraphColumnView[] = []
const NO_EDGES: readonly GraphEdgeView[] = []
const NO_LEGEND: readonly GraphLegendEntryView[] = []
const NO_SHAPES: Readonly<Record<string, number>> = {}

/** The props bag, with every absence resolved to the stable empty above. */
interface ResolvedProps {
  readonly columns: readonly GraphColumnView[]
  readonly edges: readonly GraphEdgeView[]
  readonly shapes: Readonly<Record<string, number>>
  readonly legendEntries: readonly GraphLegendEntryView[]
  readonly showLegend: boolean
}

/**
 * Resolve the absences OUTSIDE the component.
 *
 * Six default parameters plus their guards put the component over the
 * complexity cap on branching that says nothing about what it draws. Hoisting
 * them here keeps each identity stable — `props.columns ?? NO_COLUMNS` returns
 * the same reference twice — so the geometry `useMemo` downstream still keys
 * off something that does not change on every render.
 */
const resolveProps = (props: GraphIslandProps): ResolvedProps => ({
  columns: props.columns ?? NO_COLUMNS,
  edges: props.edges ?? NO_EDGES,
  shapes: props.shapes ?? NO_SHAPES,
  legendEntries: props.legendEntries ?? NO_LEGEND,
  showLegend: props.legend === true && (props.legendEntries?.length ?? 0) > 0,
})

/**
 * The figure itself — lanes when the projection sent lanes, columns otherwise.
 *
 * Extracted so `GraphIsland` below reads as the shell it is (the container, the
 * ARIA switch, the key) with exactly one line deciding what goes inside it. The
 * two geometries are computed in two `useMemo`s rather than one branching memo
 * because a hook may not be called conditionally, and the unused one folds over
 * an empty input: `layOutGraph([], edges)` walks nothing, and `layOutGraphLanes`
 * is only reached with real lanes.
 */
function GraphFigure({
  lanes,
  columns,
  edges,
  shapes,
  selectable,
  state,
}: {
  readonly lanes: GraphLanesView | undefined
  readonly columns: readonly GraphColumnView[]
  readonly edges: readonly GraphEdgeView[]
  readonly shapes: Readonly<Record<string, number>>
  readonly selectable: boolean
  readonly state: GraphSelectionState
}): ReactElement {
  const geometry = useMemo(() => layOutGraph(columns, edges), [columns, edges])
  const laneGeometry = useMemo(
    () => (lanes === undefined ? undefined : layOutGraphLanes(lanes, edges)),
    [lanes, edges]
  )
  return lanes === undefined || laneGeometry === undefined ? (
    <GraphDrawing
      geometry={geometry}
      shapes={shapes}
      selectable={selectable}
      state={state}
      onSelect={state.select}
    />
  ) : (
    <GraphLanesDrawing
      lanes={lanes}
      geometry={laneGeometry}
      shapes={shapes}
      selectable={selectable}
      state={state}
      onSelect={state.select}
    />
  )
}

/**
 * The drawing's accessible name, or its absence — the `label` switch.
 *
 * Extracted so the branch reads as one named decision rather than as a ternary
 * inside a spread, because it is the component's single most consequential
 * line: it decides whether a screen-reader user meets a named figure or meets
 * nothing at all and reads the twin instead.
 */
const drawingAria = (label: string | undefined): Readonly<Record<string, unknown>> =>
  label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label }

/**
 * Draw one bound graph.
 *
 * `label` is the accessibility SWITCH and it has exactly two states, with no
 * third: present, the drawing is `role="img"` carrying it as the accessible
 * name, so a screen-reader user meets one NAMED FIGURE instead of a canvas of
 * shapes with no text in it; absent, the drawing is `aria-hidden` and the twin
 * beneath carries the facts alone, because an unnamed figure announced as a
 * figure is noise where silence plus a real table is the better reading.
 *
 * `selection` absent is what makes the drawing non-selectable: no node takes a
 * `tabindex`, nothing is ever marked, and the reach walk never runs.
 */
export default function GraphIsland(props: GraphIslandProps): ReactElement {
  const { columns, edges, shapes, legendEntries, showLegend } = resolveProps(props)
  const selectable = props.selection !== undefined
  const state = useGraphSelection(
    edges,
    selectable,
    props.selection?.reach ?? DEFAULT_REACH,
    props.publishes
  )

  return (
    <div
      data-graph-drawing=""
      /* The figure scrolls sideways INSIDE the page rather than being clipped
       * by it. The SVG is laid out at an arithmetic width — three columns plus
       * the gaps between them — which at 1440 fits the content column and at
       * 375 does not. Measured before this class existed: at 375 the drawing
       * showed one column and half of the second, the Resources column was not
       * on the page at all, and there was no page-level horizontal scroll to
       * reach it with. The facts were unreachable rather than merely small.
       *
       * Scoped here, not on an ancestor, so the page itself never gains a
       * horizontal scrollbar — the thing that scrolls is the one thing wider
       * than its column. The legend above wraps and is unaffected.
       *
       * The twin below is the other half of this answer: a reader who would
       * rather not drag a wide figure across a phone has the same nodes and the
       * same grants as a table, in the same response. */
      className="overflow-x-auto"
      {...drawingAria(props.label)}
    >
      {/* The key comes BEFORE the figure, and on a tall drawing that is not a
       * preference. Measured on the console's own instance: the drawing is
       * 1750px tall, so a legend rendered after it sat at y=1923 while the
       * first glyph it decodes sat at y=236 — 1,687px of scrolling between a
       * mark and its meaning, which is a key nobody reaches.
       *
       * Above the figure it sits beside the column headings, where the reader
       * meets the first glyph. It stays INSIDE `[data-graph-drawing]`, so it
       * inherits the `aria-hidden` an unnamed figure takes and never announces
       * a key to a reader who is being given the twin instead. */}
      {showLegend ? <GraphLegend entries={legendEntries} /> : undefined}
      <GraphFigure
        lanes={props.lanes}
        columns={columns}
        edges={edges}
        shapes={shapes}
        selectable={selectable}
        state={state}
      />
    </div>
  )
}
