/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The view a graph component renders: the node, band, column, lane, edge and
 * twin-row shapes the projection produces from a graph envelope.
 */

import type {
  GraphColumn,
  GraphLanes,
} from '@/domain/models/app/pages/components/component-types/data/graph'
import type { GraphNodeFlagConfig } from '@/presentation/render/resolve/graph-node-flag'

/** One record of the bound envelope — a node or an edge, read loosely. */
export type GraphRecord = Readonly<Record<string, unknown>>

/** One node as the drawing and the twin both need it. */
export interface GraphNodeView {
  readonly id: string
  readonly label: string
  /** The bound graph's own word, published as `data-graph-node-kind`. */
  readonly kind: string
  /** `active` / `paused` / `disabled` on the shipped wire — open, drawn as WEIGHT. */
  readonly state?: string
  /** One short line the drawing carries as a `<title>` and the twin prints. */
  readonly detail?: string
  /** The `flag.label` of a node whose `flag.field` is true; absent on an unmarked one. */
  readonly flag?: string
}

/**
 * One band of a column — the nodes sharing a `groupBy` value.
 *
 * `value` absent is the UNGROUPED band: either the column declared no
 * `groupBy`, or these are the nodes that do not carry the field. The schema
 * puts those AFTER the named bands, and {@link bandsOf} is where that happens.
 */
export interface GraphBandView {
  readonly value?: string
  readonly nodes: readonly GraphNodeView[]
}

/** One declared column, with whatever it admitted. */
export interface GraphColumnView {
  /** The author's heading — `data-graph-column-label`, and the twin's group name. */
  readonly label: string
  readonly bands: readonly GraphBandView[]
}

/**
 * One lane — a spine node and the chain of stations reachable from it.
 *
 * `stations` is ORDERED BY THE GRAPH and by nothing else: station `n + 1` is
 * the node the edge out of station `n` arrives at. The schema refuses a
 * `sortBy` here for exactly that reason, so this array's order is a fact
 * recovered from the edges rather than a decision taken over them.
 */
export interface GraphLaneRowView {
  readonly node: GraphNodeView
  readonly stations: readonly GraphNodeView[]
}

/**
 * The whole lanes drawing — both headings, and one row per admitted lane.
 *
 * The two labels travel HERE rather than being read off the component in
 * `graph-island-host.tsx`, so the island receives one self-contained lanes
 * object and the host never has to know a lanes declaration's shape. It is the
 * same rule the columns already follow: the PROJECTION crosses, never the
 * config it was made from.
 */
export interface GraphLanesView {
  /** The spine heading — `data-graph-lane-label`, and the lanes' twin group. */
  readonly label: string
  /** The station track's heading — `data-graph-station-label`. */
  readonly stationLabel: string
  readonly rows: readonly GraphLaneRowView[]
}

/** One edge BOTH of whose endpoints were drawn. */
export interface GraphEdgeView {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: string
}

/** One row of the accessible twin — one DRAWN node, and what it reaches. */
export interface GraphTwinRowView {
  readonly id: string
  readonly label: string
  readonly kind: string
  readonly columnLabel: string
  readonly band?: string
  readonly detail?: string
  readonly flag?: string
  /** Labels of the nodes this one reaches DIRECTLY — the edges, as text. */
  readonly reaches: readonly string[]
}

/** One entry of the key: a node kind, and the shape index that stands for it. */
export interface GraphLegendEntryView {
  readonly kind: string
  readonly shape: number
}

export interface GraphDrawingView {
  readonly kind: 'drawing'
  readonly columns: readonly GraphColumnView[]
  /**
   * The lanes, under `layout: 'lanes'` — and ABSENT under `layout: 'layered'`.
   *
   * The two layouts share one `drawing` variant rather than taking one each,
   * because every other field here means the same thing in both: the edges are
   * the edges, the twin is the twin, the key is the key. Only the PLACEMENT
   * differs, so only the placement is carried twice — and `columns` is `[]`
   * whenever this is present, which is what makes "no `[data-graph-column]` in
   * a lanes drawing" fall out of the projection rather than out of a renderer
   * remembering to suppress it.
   */
  readonly lanes?: GraphLanesView
  readonly edges: readonly GraphEdgeView[]
  readonly twinRows: readonly GraphTwinRowView[]
  readonly legend: readonly GraphLegendEntryView[]
  /** Shape index per node kind — one vocabulary, so the key cannot disagree. */
  readonly shapes: Readonly<Record<string, number>>
  readonly degraded: readonly string[]
}

/**
 * The reads a graph can meet.
 *
 * THREE variants encode the FOUR states the user story names, exactly as
 * `matrix` does, because two of them differ in DATA rather than in shape:
 *
 *  - `drawing` with edges              — the healthy read;
 *  - `drawing` with NO edge            — SPARSE. Still a drawing: a set of
 *    resources nobody has been granted is a finding, not a blank;
 *  - `drawing` | `empty` with a
 *    non-empty `degraded[]`            — DEGRADED. Draws what it has and names
 *    what it could not read;
 *  - `empty`                           — no column admitted a single node, so
 *    there is no geometry and `emptyMessage` renders instead;
 *  - `unavailable`                     — the read did not succeed for THIS
 *    caller. Drawn as a notice and no drawing at all: the instance has grants,
 *    and saying it has none because this caller could not read them is the lie
 *    the endpoint's own `degraded[]` contract exists to refuse.
 */
export type GraphView =
  | GraphDrawingView
  | { readonly kind: 'empty'; readonly degraded: readonly string[] }
  | { readonly kind: 'unavailable' }

/** The declaration this projection reads, lifted off the component. */
export interface GraphProjectionConfig {
  /** The SWITCH. Anything but `'lanes'` — absent included — reads `columns`. */
  readonly layout?: string
  readonly columns?: readonly GraphColumn[]
  readonly lanes?: GraphLanes
  readonly nodesKey?: string
  readonly edgesKey?: string
  readonly flag?: GraphNodeFlagConfig
}
