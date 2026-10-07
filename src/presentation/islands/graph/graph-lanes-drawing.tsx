/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `layout: 'lanes'` DRAWING — an identity gutter, and a track of stations.
 *
 * One row per mechanism: its glyph and name on the left, then the chain of
 * steps it runs, left to right, each in a box with a short arrow to the next.
 * The shape comes from the design oracle — `processesSvg` in the admin
 * console's canvas generator — and the coordinates it implies are computed next
 * door in `graph-lanes-layout.ts`; this module only paints at them.
 *
 * ─── IT EMITS NO COLUMN AND NO BAND, AND THAT IS STRUCTURAL ────────────────
 *
 * The projection sends `columns: []` whenever it sends lanes, so there is
 * nothing here that COULD draw a `[data-graph-column]`. That is deliberate:
 * "a lanes drawing has no columns" is a consequence of the shape this file is
 * handed rather than a suppression it remembers to perform, and the two can
 * therefore never disagree.
 *
 * ─── WEIGHT COMES FROM THE LANE, THE ATTRIBUTE FROM THE NODE ───────────────
 *
 * A step carries no state of its own — the wire gives it none — yet a disabled
 * mechanism's whole row must read as disabled, which is what the oracle draws:
 * one stroke colour and one dash pattern for the lane, applied to every box in
 * it. So the VISUAL weight is the lane's, spread across its stations, while
 * `data-graph-node-state` is published strictly from the node that carries it.
 * A station therefore looks paused inside a paused lane and still says nothing
 * about a state it does not have.
 *
 * ─── AND THE ARIA IS BARE, FOR THE REASON THE LAYERED DRAWING GIVES ────────
 *
 * `[data-graph-drawing]` is either a named `role="img"` or `aria-hidden`, and
 * assistive technology ignores everything inside it in both states. The nodes
 * take `tabindex` and no role, serving the SIGHTED keyboard user; every fact is
 * carried for everybody else by the accessible twin, which is server-rendered
 * outside this island.
 *
 * @see ./graph-lanes-layout.ts — where each of these coordinates comes from
 * @see ./graph-drawing.tsx — the layered sibling
 */

import { useGraphClipIds } from '@/presentation/islands/graph/graph-clip-ids'
import { stateWeight } from '@/presentation/islands/graph/graph-shapes'
import { LanesTextClips } from '@/presentation/islands/graph/graph-text-clip'
import { GLYPH_RADIUS, GLYPH_CX, HEADING_DY, HEADING_CLASS } from './graph-lane-geometry'
import { LaneIdentity, LaneStation, LaneConnectors } from './graph-lane-parts'
import type { GraphClipIds } from '@/presentation/islands/graph/graph-clip-ids'
import type { GraphLanesView } from '@/presentation/islands/graph/graph-island-types'
import type {
  GraphLanesGeometry,
  PlacedLane,
} from '@/presentation/islands/graph/graph-lanes-layout'
import type { GraphSelectionState } from '@/presentation/islands/graph/use-graph-selection'
import type { ReactElement } from 'react'

function GraphLane({
  lane,
  shape,
  stateX,
  clips,
  selectable,
  state,
  onSelect,
}: {
  readonly lane: PlacedLane
  readonly shape: number
  readonly stateX: number
  readonly clips: GraphClipIds
  readonly selectable: boolean
  readonly state: GraphSelectionState
  readonly onSelect: (id: string) => void
}): ReactElement {
  const weight = stateWeight(lane.node.state)
  return (
    <g data-graph-lane={lane.node.id}>
      <LaneConnectors
        lane={lane}
        dash={weight.dash}
        state={state}
      />
      <LaneIdentity
        lane={lane}
        shape={shape}
        stateX={stateX}
        clipId={clips.gutter}
        selectable={selectable}
        state={state}
        onSelect={onSelect}
      />
      {lane.stations.map((station) => (
        <LaneStation
          key={station.id}
          station={station}
          muted={weight.muted}
          dash={weight.dash}
          clipId={clips.box}
          selectable={selectable}
          state={state}
          onSelect={onSelect}
        />
      ))}
    </g>
  )
}

/** The strip naming each half of the figure — the gutter, then the track. */
function LanesHeadings({
  lanes,
  stationX,
}: {
  readonly lanes: GraphLanesView
  readonly stationX: number
}): ReactElement {
  return (
    <>
      <text
        data-graph-lane-label=""
        x={GLYPH_CX - GLYPH_RADIUS - 2}
        y={HEADING_DY}
        className={HEADING_CLASS}
        fill="currentColor"
      >
        {lanes.label}
      </text>
      <text
        data-graph-station-label=""
        x={stationX}
        y={HEADING_DY}
        className={HEADING_CLASS}
        fill="currentColor"
      >
        {lanes.stationLabel}
      </text>
    </>
  )
}

/** The whole canvas: two headings, then one group per lane. */
export function GraphLanesDrawing({
  lanes,
  geometry,
  shapes,
  selectable,
  state,
  onSelect,
}: {
  readonly lanes: GraphLanesView
  readonly geometry: GraphLanesGeometry
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
      <LanesTextClips
        ids={clips}
        height={geometry.height}
      />
      <LanesHeadings
        lanes={lanes}
        stationX={geometry.stationX}
      />
      {geometry.lanes.map((lane) => (
        <GraphLane
          key={lane.node.id}
          lane={lane}
          shape={shapes[lane.node.kind] ?? 0}
          stateX={geometry.stateX}
          clips={clips}
          selectable={selectable}
          state={state}
          onSelect={onSelect}
        />
      ))}
    </svg>
  )
}
