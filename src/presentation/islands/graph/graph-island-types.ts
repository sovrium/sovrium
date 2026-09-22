/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape the `graph` island is mounted with.
 *
 * ─── WHY THIS IS DECLARED HERE AND NOT IMPORTED ────────────────────────────
 *
 * These types mirror `@/presentation/render/resolve/graph-projection` exactly,
 * and they are re-declared rather than imported because NO island imports from
 * `@/presentation/render/**` — the boundaries config is what says so, and zero
 * of the ~40 islands do. That is not an accident to work around: the two trees
 * meet as JSON in `data-island-props`, so a shared TypeScript type would assert
 * a compile-time coupling the runtime does not have.
 *
 * Every island already has this shape — `KpiIslandProps`, the chart's prop bag
 * — so the duplication is the platform's convention rather than this
 * component's debt. The projection module names this file in its own header, so
 * a change to one has a pointer to the other.
 *
 * ─── AND THE ENDPOINT'S VOCABULARY NEVER REACHES HERE ──────────────────────
 *
 * `kind` and `state` are OPEN strings, and this island never compares either to
 * a literal. A kind arrives already paired with a shape index the projection
 * assigned by first appearance, and a state drives weight through a lookup that
 * falls through to "no weight" for a word it does not know. So an endpoint with
 * a different node vocabulary draws here unchanged, which is the whole reason
 * the schema left those keys open.
 */

/** One node, as the projection placed it. */
export interface GraphNodeView {
  readonly id: string
  readonly label: string
  /** The bound graph's own word. Opaque here — never compared to a literal. */
  readonly kind: string
  /** The bound graph's own word for an operational state, where it has one. */
  readonly state?: string
  /** One short line, carried to a pointer as a `<title>`; the twin prints it. */
  readonly detail?: string
}

/** One band of a column. `value` absent is the ungrouped band. */
export interface GraphBandView {
  readonly value?: string
  readonly nodes: readonly GraphNodeView[]
}

/** One declared column, with whatever it admitted. */
export interface GraphColumnView {
  readonly label: string
  readonly bands: readonly GraphBandView[]
}

/** One lane — a spine node, and the chain of stations reachable from it. */
export interface GraphLaneRowView {
  readonly node: GraphNodeView
  readonly stations: readonly GraphNodeView[]
}

/**
 * The lanes drawing: both headings and one row per lane.
 *
 * The two labels arrive INSIDE this object rather than as sibling props, so
 * "there are lanes" and "the lanes are headed like this" cannot disagree — a
 * `laneLabel` prop beside an absent `lanes` would be a heading over nothing.
 */
export interface GraphLanesView {
  readonly label: string
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

/** One entry of the key: a node kind and the shape index standing for it. */
export interface GraphLegendEntryView {
  readonly kind: string
  readonly shape: number
}

/** Which way the reach highlight walks. Closed, and the island enumerates it. */
export type GraphReach = 'downstream' | 'upstream' | 'both'

/** The selection declaration, as it arrives in the props bag. */
export interface GraphSelectionConfig {
  readonly mode?: string
  readonly reach?: GraphReach
}

/** The publisher declaration — the same two required keys the shared bus takes. */
export interface GraphPublishesConfig {
  readonly bindTo: string
  readonly param: string
}

export interface GraphIslandProps {
  readonly columns?: readonly GraphColumnView[]
  /**
   * Present: draw LANES. Absent: draw the columns.
   *
   * The two are mutually exclusive by construction rather than by agreement —
   * the projection sends `columns: []` whenever it sends lanes — so this
   * island reads one switch and never has to decide which of two populated
   * placements wins.
   */
  readonly lanes?: GraphLanesView
  readonly edges?: readonly GraphEdgeView[]
  /** Shape index per node kind, assigned by the projection — never re-derived. */
  readonly shapes?: Readonly<Record<string, number>>
  readonly legendEntries?: readonly GraphLegendEntryView[]
  /** The author's boolean: draw the key at all. Distinct from `legendEntries`. */
  readonly legend?: boolean
  /** Present: the drawing is a named figure. Absent: it is `aria-hidden`. */
  readonly label?: string
  /** Absent: the drawing is not selectable. */
  readonly selection?: GraphSelectionConfig
  readonly publishes?: GraphPublishesConfig
}
