/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where every lane, station and connector of a `layout: 'lanes'` drawing sits.
 *
 * ─── THE SAME ARITHMETIC THE LAYERED GEOMETRY USES, ON ONE AXIS ────────────
 *
 * `graph-layout.ts` next door places a node from its column index and the
 * running height of the bands above it. This places one from its position ALONG
 * ITS LANE and the lane's index. Both are pure arithmetic: nothing iterates,
 * nothing settles, nothing is random, and the same read draws identically
 * twice. That property is why neither module reaches for a force simulation,
 * and it is worth restating here because a lanes drawing looks like the kind of
 * thing a layout engine would be brought in for.
 *
 * It also reuses `COLUMN_WIDTH`, `NODE_HEIGHT` and `HEADER_HEIGHT` rather than
 * declaring its own: a station box IS a node box, so two copies of 176 x 28
 * would be two numbers to keep equal by hand.
 *
 * ─── THE IDENTITY GUTTER IS SLOT ZERO ──────────────────────────────────────
 *
 * The tempting model is "a gutter, then a track", with the track's first box a
 * special case whose left edge is the gutter's width. It is not modelled that
 * way. A lane is ONE CHAIN of slots — slot 0 is the lane node, slot `k + 1` is
 * station `k` — and every slot's `x` is `slot * STATION_PITCH`. The gutter is
 * therefore a box-width of room that happens to be drawn as text rather than as
 * a box, and the connector between slot 0 and slot 1 is computed by exactly the
 * expression that joins slot 3 to slot 4.
 *
 * One rule instead of two, and the first connector stops being the one place a
 * reader has to check separately.
 *
 * ─── WHAT THE FIGURES ARE, AND WHERE THEY CAME FROM ────────────────────────
 *
 * From the design oracle — `processesSvg` in the admin console's canvas
 * generator (`[internal ref]
 * generator/org.mjs`). Lane height 46, a 176 x 28 rx=4 box at a 200px pitch, a
 * 24px connector with an arrowhead, and the lanes starting at y=30. That last
 * one is not a coincidence to be maintained: `HEADER_HEIGHT + 4` is what
 * `placeColumn` already uses for its first band, and it is 30.
 *
 * @see ./graph-lanes-drawing.tsx — what is painted at these coordinates
 * @see ./graph-layout.ts — the layered sibling, and the shared box metrics
 */

import { COLUMN_WIDTH, HEADER_HEIGHT, NODE_HEIGHT } from '@/presentation/islands/graph/graph-layout'
import type {
  GraphEdgeView,
  GraphLanesView,
  GraphNodeView,
} from '@/presentation/islands/graph/graph-island-types'

/** One lane's own band of the canvas, heading to heading. */
const LANE_HEIGHT = 46

/** Room between one slot's box and the next — where the connector is drawn. */
const STATION_GAP = 24

/** Slot to slot, left edge to left edge. */
const STATION_PITCH = COLUMN_WIDTH + STATION_GAP

/** The box's top inside its lane. Not centred — the oracle's own inset. */
const NODE_INSET = 6

/** Room kept at the right edge for the state word an inactive lane carries. */
const STATE_WIDTH = 64

/** How far the state word sits in from the right edge. */
const STATE_PADDING = 8

/** Breathing room at the drawing's bottom edge, as the layered geometry uses. */
const BOTTOM_PADDING = 8

/** Where the first lane's band starts — the same line the first band uses. */
const FIRST_LANE_TOP = HEADER_HEIGHT + 4

/** One station, placed along its lane. */
export interface PlacedStation extends GraphNodeView {
  /** 0-based position ALONG THIS LANE's chain — published as `data-graph-station`. */
  readonly index: number
  readonly x: number
  readonly y: number
}

/** One connector: the short line and arrowhead joining two consecutive slots. */
export interface PlacedConnector {
  /** The drawn edge it stands for, so selection marks it like any other edge. */
  readonly id: string
  /** Left end of the line — the right edge of the slot it leaves. */
  readonly x: number
  readonly y: number
}

/** One lane: its identity gutter, its stations, and the lines between them. */
export interface PlacedLane {
  readonly node: GraphNodeView
  /** Top of this lane's band. Everything in the lane is offset from it. */
  readonly top: number
  readonly stations: readonly PlacedStation[]
  readonly connectors: readonly PlacedConnector[]
}

export interface GraphLanesGeometry {
  readonly lanes: readonly PlacedLane[]
  /** Where the spine heading and the state words sit. */
  readonly stationX: number
  readonly stateX: number
  readonly width: number
  readonly height: number
}

/** The left edge of slot `n` — slot 0 being the identity gutter. */
const slotX = (slot: number): number => slot * STATION_PITCH

/**
 * The connectors along one chain.
 *
 * One per CONSECUTIVE PAIR that a drawn edge actually joins, and the lookup is
 * what keeps this honest: a chain whose two neighbours are joined by no edge in
 * the drawn set gets no line between them, rather than a line asserting a
 * relation the body never carried.
 *
 * An edge between two drawn nodes that are NOT neighbours in a chain is drawn
 * by nothing here. That is the lens rather than a gap: a lanes drawing shows
 * each mechanism's own sequence, and a line cutting across three lanes would be
 * the layered reading of a wire this layout is deliberately not giving.
 */
const connectorsOf = (
  chain: readonly GraphNodeView[],
  edges: readonly GraphEdgeView[],
  top: number
): readonly PlacedConnector[] =>
  chain.flatMap((node, slot) => {
    const next = chain[slot + 1]
    if (next === undefined) return []
    const edge = edges.find((one) => one.from === node.id && one.to === next.id)
    return edge === undefined
      ? []
      : [{ id: edge.id, x: slotX(slot) + COLUMN_WIDTH, y: top + NODE_INSET + NODE_HEIGHT / 2 }]
  })

/** Place one lane's stations and connectors against the top of its band. */
const placeLane = (
  row: GraphLanesView['rows'][number],
  index: number,
  edges: readonly GraphEdgeView[]
): PlacedLane => {
  const top = FIRST_LANE_TOP + index * LANE_HEIGHT
  return {
    node: row.node,
    top,
    stations: row.stations.map((station, position) => ({
      ...station,
      index: position,
      x: slotX(position + 1),
      y: top + NODE_INSET,
    })),
    connectors: connectorsOf([row.node, ...row.stations], edges, top),
  }
}

/**
 * Place every lane, and size the canvas to hold the longest one.
 *
 * The width is CONTENT-DRIVEN rather than the oracle's fixed 1040: a drawing of
 * three one-step mechanisms should not reserve room for five, and one with
 * eight steps must not be clipped at five. The figure the oracle fixed is a
 * mock's convenience; the arithmetic behind it is what transfers.
 *
 * A wide drawing is not scaled down to fit. It scrolls inside its own container
 * — `[data-graph-drawing]` carries `overflow-x-auto` — which is the same answer
 * the layered drawing already gives, and for the same reason: the station names
 * are the facts an operator came to read, and shrinking them to fit a phone
 * makes the figure fit and the facts unreadable.
 */
export const layOutGraphLanes = (
  lanes: GraphLanesView,
  edges: readonly GraphEdgeView[]
): GraphLanesGeometry => {
  const placed = lanes.rows.map((row, index) => placeLane(row, index, edges))
  const content = Math.max(
    STATION_PITCH,
    ...placed.map((lane) => slotX(lane.stations.length) + COLUMN_WIDTH)
  )
  const width = content + STATE_WIDTH
  return {
    lanes: placed,
    stationX: slotX(1),
    stateX: width - STATE_PADDING,
    width,
    height: FIRST_LANE_TOP + placed.length * LANE_HEIGHT + BOTTOM_PADDING,
  }
}
