/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `graph` DRAWING — the column strip, the banded nodes, and the edges.
 *
 * ─── THE ARIA INSIDE THIS FIGURE IS DELIBERATELY BARE ──────────────────────
 *
 * `[data-graph-drawing]` is either `role="img"` with an accessible name or
 * `aria-hidden="true"`, and in BOTH states assistive technology ignores
 * everything inside it — a named image is announced as one thing, and a hidden
 * subtree is announced as nothing. So the nodes carry `tabindex` and no ARIA
 * role: a `role="button"` here would be decoration in one state and unreachable
 * in the other.
 *
 * That is not an accessibility gap, it is the division of labour the component
 * is built on. The keyboard-reachable nodes serve the SIGHTED keyboard user who
 * can see the drawing and wants to select in it; the accessible twin, rendered
 * on the server outside this island, carries every fact for everybody else.
 *
 * ─── AND THE PAINT ORDER IS LOAD-BEARING ───────────────────────────────────
 *
 * Edges are painted BEFORE nodes, in one group, so a line passing behind a node
 * box is occluded by it rather than drawn across its name. On the console's own
 * instance the Resources column is 47 nodes tall and every one of its edges
 * crosses the whole canvas, so this is the difference between a readable map
 * and a hatch pattern.
 *
 * @see ./graph-shapes.ts — why a glyph is generated rather than looked up
 * @see ./use-graph-selection.ts — what marks a node reached, dimmed or selected
 */

import { useGraphClipIds } from '@/presentation/islands/graph/graph-clip-ids'
import { COLUMN_WIDTH, HEADER_HEIGHT, NODE_HEIGHT } from '@/presentation/islands/graph/graph-layout'
import {
  DIMMED_OPACITY,
  nodeClassOf,
  stateMark,
  useNodeInteraction,
} from '@/presentation/islands/graph/graph-node-interaction'
import { polygonPoints, stateWeight } from '@/presentation/islands/graph/graph-shapes'
import { LayeredTextClips } from '@/presentation/islands/graph/graph-text-clip'
import { selectionMarks } from '@/presentation/islands/graph/use-graph-selection'
import type {
  GraphGeometry,
  PlacedColumn,
  PlacedNode,
} from '@/presentation/islands/graph/graph-layout'
import type { GraphSelectionState } from '@/presentation/islands/graph/use-graph-selection'
import type { ReactElement } from 'react'

/**
 * What an edge is drawn at when nothing is selected.
 *
 * 0.35, and the figure is chosen for what a real access graph looks like
 * rather than for what one edge looks like. Edges BUNDLE: measured on the
 * console's own instance, 45 of the 46 leave the same open-rung node, and
 * translucent strokes compound where they overlap. At 0.55 that fan rendered
 * as a solid black slab with no countable lines in it — which is the one thing
 * a bundle must not become, because its DENSITY is the finding. At 0.35 the
 * overlap reads as a wash that darkens with the count, and a lone edge is
 * still plainly drawn.
 *
 * Selection is answered with WEIGHT rather than with more ink (a reached edge
 * takes `strokeWidth` 2), so it stays legible inside a bundle without the
 * resting state having to shout.
 */
const EDGE_OPACITY = 0.35

/** The glyph's radius, and where it sits inside the node box. */
const GLYPH_RADIUS = 7
const GLYPH_X = 16
const LABEL_X = 30

/** The marks inside one node box: its frame, its kind glyph and its name. */
function NodeBody({
  node,
  shape,
  selected,
  dash,
  clipId,
}: {
  readonly node: PlacedNode
  readonly shape: number
  readonly selected: boolean
  readonly dash: string | undefined
  readonly clipId: string
}): ReactElement {
  return (
    <>
      {/* `fill="transparent"`, NEVER `fill="none"` — the difference is the
       * whole click target. SVG's default `pointer-events: visiblePainted`
       * only hit-tests the PAINTED area, and `none` paints no interior: a
       * pointer over the middle of the box falls straight through to the
       * canvas, so the node is clickable on its one-pixel stroke and nowhere
       * else. `transparent` is a painted fill with zero alpha — visually
       * identical, and the whole box becomes the target. */}
      <rect
        x={node.x}
        y={node.y}
        width={COLUMN_WIDTH}
        height={NODE_HEIGHT}
        rx={4}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={selected ? 2 : 1}
        {...(dash === undefined ? {} : { strokeDasharray: dash })}
      />
      <polygon
        points={polygonPoints(shape, GLYPH_RADIUS)}
        transform={`translate(${String(node.x + GLYPH_X)},${String(node.y + NODE_HEIGHT / 2)})`}
        fill="currentColor"
      />
      {/* Held inside its own box, and positioned by TRANSFORM so the one frame
       * declared at the origin lands on this one — see `graph-text-clip.tsx`.
       * A node label is as unbounded as the lanes gutter's was; this drawing
       * had the same hole and had only been lucky in the labels it had met. */}
      <text
        transform={`translate(${String(node.x)},${String(node.y)})`}
        x={LABEL_X}
        y={NODE_HEIGHT / 2 + 4}
        clipPath={`url(#${clipId})`}
        className="text-[11px]"
        fill="currentColor"
      >
        {node.label}
      </text>
      <title>{node.detail === undefined ? node.label : `${node.label} — ${node.detail}`}</title>
    </>
  )
}

/** One node: its box, its kind glyph, and its name. */
function GraphNode({
  node,
  shape,
  clipId,
  selectable,
  state,
  onSelect,
}: {
  readonly node: PlacedNode
  readonly shape: number
  readonly clipId: string
  readonly selectable: boolean
  readonly state: GraphSelectionState
  readonly onSelect: (id: string) => void
}): ReactElement {
  const weight = stateWeight(node.state)
  const marks = selectionMarks(node.id, state, state.reachedNodes)
  const interaction = useNodeInteraction(node.id, selectable, onSelect)
  return (
    <g
      data-graph-node={node.id}
      data-graph-node-kind={node.kind}
      {...stateMark(node.state)}
      {...marks}
      {...interaction}
      className={nodeClassOf(weight.muted, selectable)}
      opacity={marks['data-graph-dimmed'] === undefined ? 1 : DIMMED_OPACITY}
    >
      <NodeBody
        node={node}
        shape={shape}
        selected={marks['data-graph-selected'] !== undefined}
        dash={weight.dash}
        clipId={clipId}
      />
    </g>
  )
}

/**
 * One column: its heading, then one group per band.
 *
 * A band carrying no `groupBy` value emits NO `data-graph-band` attribute, for
 * the reason `matrix` gives next door: an attribute naming nothing would still
 * count as a band in every census of them, so the ungrouped remainder would
 * read as a group the author never declared.
 */
function GraphColumn({
  column,
  shapes,
  clipId,
  selectable,
  state,
  onSelect,
}: {
  readonly column: PlacedColumn
  readonly shapes: Readonly<Record<string, number>>
  readonly clipId: string
  readonly selectable: boolean
  readonly state: GraphSelectionState
  readonly onSelect: (id: string) => void
}): ReactElement {
  return (
    <g
      data-graph-column={column.index}
      data-graph-column-label={column.label}
    >
      <text
        x={column.x}
        y={HEADER_HEIGHT - 10}
        className="text-foreground-subtle text-[11px]"
        fill="currentColor"
      >
        {column.label}
      </text>
      {column.bands.map((band, index) => (
        <g
          key={band.value ?? `band-${String(index)}`}
          {...(band.value === undefined ? {} : { 'data-graph-band': band.value })}
        >
          {band.value === undefined || band.captionY === undefined ? undefined : (
            <text
              x={column.x}
              y={band.captionY}
              className="text-foreground-subtle text-[10px]"
              fill="currentColor"
            >
              {band.value}
            </text>
          )}
          {band.nodes.map((node) => (
            <GraphNode
              key={node.id}
              node={node}
              shape={shapes[node.kind] ?? 0}
              clipId={clipId}
              selectable={selectable}
              state={state}
              onSelect={onSelect}
            />
          ))}
        </g>
      ))}
    </g>
  )
}

/** The whole canvas: edges under, columns over. */
export function GraphDrawing({
  geometry,
  shapes,
  selectable,
  state,
  onSelect,
}: {
  readonly geometry: GraphGeometry
  readonly shapes: Readonly<Record<string, number>>
  readonly selectable: boolean
  readonly state: GraphSelectionState
  readonly onSelect: (id: string) => void
}): ReactElement {
  const clips = useGraphClipIds()
  return (
    <svg
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${String(geometry.width)} ${String(geometry.height)}`}
      className="text-foreground block"
    >
      <LayeredTextClips ids={clips} />
      <g
        fill="none"
        stroke="currentColor"
      >
        {geometry.edges.map((edge) => {
          const marks = selectionMarks(edge.id, state, state.reachedEdges)
          return (
            <path
              key={edge.id}
              data-graph-edge={edge.id}
              {...marks}
              d={edge.path}
              strokeWidth={marks['data-graph-reached'] === undefined ? 1 : 2}
              opacity={marks['data-graph-dimmed'] === undefined ? EDGE_OPACITY : DIMMED_OPACITY}
            />
          )
        })}
      </g>
      {geometry.columns.map((column) => (
        <GraphColumn
          key={column.index}
          column={column}
          shapes={shapes}
          clipId={clips.box}
          selectable={selectable}
          state={state}
          onSelect={onSelect}
        />
      ))}
    </svg>
  )
}
