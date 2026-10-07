/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COLUMN_WIDTH, NODE_HEIGHT } from '@/presentation/islands/graph/graph-layout'
import {
  DIMMED_OPACITY,
  nodeClassOf,
  stateMark,
  useNodeInteraction,
} from '@/presentation/islands/graph/graph-node-interaction'
import { polygonPoints, stateWeight } from '@/presentation/islands/graph/graph-shapes'
import { selectionMarks } from '@/presentation/islands/graph/use-graph-selection'
import {
  EDGE_OPACITY,
  GLYPH_RADIUS,
  GLYPH_CX,
  GLYPH_DY,
  GUTTER_TEXT_X,
  NAME_DY,
  DETAIL_DY,
  STATE_DY,
  CONNECTOR_LENGTH,
} from './graph-lane-geometry'
import type { PlacedLane, PlacedStation } from '@/presentation/islands/graph/graph-lanes-layout'
import type { GraphSelectionState } from '@/presentation/islands/graph/use-graph-selection'
import type { ReactElement } from 'react'

/**
 * The pieces one lane is drawn from: its identity and caption in the gutter,
 * its state line, each station with its label, and the connectors between
 * stations.
 */

/**
 * The state word an inactive lane carries, right-aligned at the drawing's edge.
 *
 * Drawn only for a state that is present AND not `active`, which is two
 * conditions doing two different jobs. Skipping `active` is the oracle's own
 * rule — labelling the ordinary case is noise on every row. Skipping ABSENCE is
 * the contract: a lane whose state could not be read must not be captioned at
 * all, because any word here would be a claim the read did not support.
 */
function LaneState({
  state,
  x,
  y,
}: {
  readonly state: string | undefined
  readonly x: number
  readonly y: number
}): ReactElement | undefined {
  if (state === undefined || state === 'active') return undefined
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      className="text-[10px]"
      fill="currentColor"
    >
      {state}
    </text>
  )
}

/**
 * What is drawn inside the gutter: the kind glyph, the name, and the sub-line.
 *
 * Split from the `<g>` around it so neither half is doing two jobs — that one
 * owns identity and interaction, this one owns the marks. The sub-line is the
 * wire's own `detail`, and it is omitted rather than blanked when the node
 * carries none: an empty second line would reserve the space of a fact the read
 * never produced.
 *
 * BOTH lines are clipped to the gutter, not just the sub-line that was observed
 * overrunning. A lane's `label` is as unbounded as its `detail`, and a frame
 * that held one and not the other would be waiting for the first long name.
 * Only the two text runs take the clip — the glyph is drawn well inside the
 * band, and the state word sits at the drawing's far edge, so a frame around
 * the whole caption would delete it.
 */
function LaneCaption({
  node,
  top,
  shape,
  clipId,
}: {
  readonly node: PlacedLane['node']
  readonly top: number
  readonly shape: number
  readonly clipId: string
}): ReactElement {
  return (
    <>
      <polygon
        points={polygonPoints(shape, GLYPH_RADIUS)}
        transform={`translate(${String(GLYPH_CX)},${String(top + GLYPH_DY)})`}
        fill="currentColor"
      />
      <text
        x={GUTTER_TEXT_X}
        y={top + NAME_DY}
        clipPath={`url(#${clipId})`}
        className="text-xs font-medium"
        fill="currentColor"
      >
        {node.label}
      </text>
      {node.detail === undefined ? undefined : (
        <text
          x={GUTTER_TEXT_X}
          y={top + DETAIL_DY}
          clipPath={`url(#${clipId})`}
          className="text-foreground-subtle text-[10px]"
          fill="currentColor"
        >
          {node.detail}
        </text>
      )}
      <title>{node.detail === undefined ? node.label : `${node.label} — ${node.detail}`}</title>
    </>
  )
}

/** The lane node itself — the focusable, selectable half of the gutter. */
export function LaneIdentity({
  lane,
  shape,
  stateX,
  clipId,
  selectable,
  state,
  onSelect,
}: {
  readonly lane: PlacedLane
  readonly shape: number
  readonly stateX: number
  readonly clipId: string
  readonly selectable: boolean
  readonly state: GraphSelectionState
  readonly onSelect: (id: string) => void
}): ReactElement {
  const { node } = lane
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
      <LaneCaption
        node={node}
        top={lane.top}
        shape={shape}
        clipId={clipId}
      />
      <LaneState
        state={node.state}
        x={stateX}
        y={lane.top + STATE_DY}
      />
    </g>
  )
}

/**
 * A station's own name, centred in its box and held inside it.
 *
 * Positioned by TRANSFORM rather than by absolute coordinates, so the one box
 * frame declared at the origin lands on this box — see `graph-text-clip.tsx`.
 * The pair resolves to the same pixel the absolute form did: `translate(x, y)`
 * and then a centre of `COLUMN_WIDTH / 2`.
 */
function StationLabel({
  station,
  clipId,
}: {
  readonly station: PlacedStation
  readonly clipId: string
}): ReactElement {
  return (
    <text
      transform={`translate(${String(station.x)},${String(station.y)})`}
      x={COLUMN_WIDTH / 2}
      y={NODE_HEIGHT / 2 + 4}
      clipPath={`url(#${clipId})`}
      textAnchor="middle"
      className="text-[11px]"
      fill="currentColor"
    >
      {station.label}
    </text>
  )
}

/** One station box, carrying its position along the lane. */
export function LaneStation({
  station,
  muted,
  dash,
  clipId,
  selectable,
  state,
  onSelect,
}: {
  readonly station: PlacedStation
  readonly muted: boolean
  readonly dash: string | undefined
  readonly clipId: string
  readonly selectable: boolean
  readonly state: GraphSelectionState
  readonly onSelect: (id: string) => void
}): ReactElement {
  const marks = selectionMarks(station.id, state, state.reachedNodes)
  const interaction = useNodeInteraction(station.id, selectable, onSelect)
  return (
    <g
      data-graph-node={station.id}
      data-graph-node-kind={station.kind}
      data-graph-station={station.index}
      {...stateMark(station.state)}
      {...marks}
      {...interaction}
      className={nodeClassOf(muted, selectable)}
      opacity={marks['data-graph-dimmed'] === undefined ? 1 : DIMMED_OPACITY}
    >
      {/* `fill="transparent"`, NEVER `fill="none"` — the difference is the whole
       * click target. SVG's default `pointer-events: visiblePainted` hit-tests
       * the PAINTED area only, and `none` paints no interior, so a pointer over
       * the middle of the box falls through to the canvas and the station is
       * clickable on its one-pixel stroke and nowhere else. */}
      <rect
        x={station.x}
        y={station.y}
        width={COLUMN_WIDTH}
        height={NODE_HEIGHT}
        rx={4}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={marks['data-graph-selected'] === undefined ? 1 : 2}
        {...(dash === undefined ? {} : { strokeDasharray: dash })}
      />
      <StationLabel
        station={station}
        clipId={clipId}
      />
      <title>{station.label}</title>
    </g>
  )
}

/**
 * One lane: its connectors first, then its identity and its stations.
 *
 * The connectors are painted BEFORE the boxes for the reason the layered
 * drawing paints its edges first — a line running under a box is occluded by it
 * rather than drawn across the name inside it.
 *
 * The glyph shape is looked up per node rather than fixed per role, because a
 * lanes drawing over a different endpoint may admit several lane kinds and
 * several station kinds. The index was assigned by the projection, so the key
 * above the figure decodes it without this file knowing a single kind's name.
 */
/**
 * The lines between one lane's consecutive slots.
 *
 * Each is ONE path — the rule and its chevron in a single `d` — which halves
 * the element count of a drawing whose whole content is short arrows, and keeps
 * `data-graph-edge` on exactly one element per drawn edge so a census of them
 * counts edges rather than strokes. The dash the lane's state gives therefore
 * reaches the chevron too, where the oracle leaves the arrowhead solid; that is
 * the one deliberate divergence from it, taken for the element count.
 */
export function LaneConnectors({
  lane,
  dash,
  state,
}: {
  readonly lane: PlacedLane
  readonly dash: string | undefined
  readonly state: GraphSelectionState
}): ReactElement {
  return (
    <g
      fill="none"
      stroke="currentColor"
    >
      {lane.connectors.map((connector) => {
        const marks = selectionMarks(connector.id, state, state.reachedEdges)
        return (
          <path
            key={connector.id}
            data-graph-edge={connector.id}
            {...marks}
            d={`M${String(connector.x)} ${String(connector.y)}h${String(CONNECTOR_LENGTH)}m-4 -4l4 4-4 4`}
            strokeWidth={marks['data-graph-reached'] === undefined ? 1 : 2}
            opacity={marks['data-graph-dimmed'] === undefined ? EDGE_OPACITY : DIMMED_OPACITY}
            {...(dash === undefined ? {} : { strokeDasharray: dash })}
          />
        )
      })}
    </g>
  )
}
