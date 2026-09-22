/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where every node and every edge of a layered `graph` sits, in pixels.
 *
 * ─── COMPUTED, NEVER SIMULATED ─────────────────────────────────────────────
 *
 * The columns are declared, the bands are projected and the order is already
 * decided by the time this module runs, so the geometry is arithmetic: a node's
 * `x` is its column index, its `y` is the running height of the band stack
 * above it. Nothing iterates, nothing settles, nothing is random.
 *
 * That is why there is no force layout here, and the reason is not only that
 * `@visx/network` is absent from `node_modules`. A force simulation is
 * non-deterministic — the same read draws differently twice — which makes a
 * visual regression untellable from a re-run, and it needs a browser to settle,
 * which makes it hostile to the server-rendered half of this component. A
 * declared layered drawing has neither problem.
 *
 * ─── AND THE DRAWING IS ALLOWED TO BE TALL ─────────────────────────────────
 *
 * Measured on the console's own app the three columns hold 1, 4 and 47 nodes,
 * so the drawing is roughly 1,700px tall and mostly empty on the left. That is
 * the NORMAL shape of this lens rather than a defect — the matrix next door is
 * equally tall and ships — and nothing here caps a column or elides its tail.
 * Hiding nodes would hide exactly the facts an operator opened the page to
 * audit. It is drawn whole, and the page scrolls.
 */

import { pathHorizontalDiagonal } from '@visx/shape'
import type {
  GraphColumnView,
  GraphEdgeView,
  GraphNodeView,
} from '@/presentation/islands/graph/graph-island-types'

/** Width of one column's node box. A name is what has to fit, not a mark. */
export const COLUMN_WIDTH = 176

/** Horizontal room between two columns — where the edges are drawn. */
const COLUMN_GAP = 104

/** Height of one node box, and the gap under it. */
export const NODE_HEIGHT = 28
const NODE_GAP = 6

/** The band caption's own line, and the room after a band closes. */
const BAND_LABEL_HEIGHT = 18
const BAND_GAP = 12

/** The column heading strip at the top of the drawing. */
export const HEADER_HEIGHT = 26

/** Breathing room at the drawing's bottom edge. */
const BOTTOM_PADDING = 8

/** One node, placed. */
export interface PlacedNode extends GraphNodeView {
  readonly x: number
  readonly y: number
}

/** One band, placed — its caption line and the nodes under it. */
export interface PlacedBand {
  readonly value?: string
  readonly captionY?: number
  readonly nodes: readonly PlacedNode[]
}

/** One declared column, placed. */
export interface PlacedColumn {
  readonly index: number
  readonly label: string
  readonly x: number
  readonly bands: readonly PlacedBand[]
}

/** One drawn edge, with the bezier that joins its two endpoints. */
export interface PlacedEdge extends GraphEdgeView {
  readonly path: string
}

export interface GraphGeometry {
  readonly columns: readonly PlacedColumn[]
  readonly edges: readonly PlacedEdge[]
  readonly width: number
  readonly height: number
}

interface Point {
  readonly x: number
  readonly y: number
}

interface Segment {
  readonly source: Point
  readonly target: Point
}

/**
 * The edge generator — a horizontal cubic bezier between two points.
 *
 * Both accessors are passed explicitly rather than left to default. `@visx`
 * defaults `x` to the datum's `y` and `y` to its `x`, because its horizontal
 * links are built from a vertical tree layout with the coordinates swapped;
 * the points here are already in screen space, so overriding both is what keeps
 * the swap from silently transposing the whole drawing.
 */
const linkPath = pathHorizontalDiagonal<Segment, Point>({
  source: (link) => link.source,
  target: (link) => link.target,
  x: (node) => node.x,
  y: (node) => node.y,
})

/** Lay one column's bands out from `top`, returning the bands and the height used. */
const placeColumn = (
  column: GraphColumnView,
  index: number
): { readonly placed: PlacedColumn; readonly height: number } => {
  const x = index * (COLUMN_WIDTH + COLUMN_GAP)
  // A running cursor, folded rather than mutated: each band is placed against
  // the height of everything above it, and the fold carries that height.
  const { bands, cursor } = column.bands.reduce<{
    readonly bands: readonly PlacedBand[]
    readonly cursor: number
  }>(
    (acc, band) => {
      const captioned = band.value !== undefined
      const top = acc.cursor + (captioned ? BAND_LABEL_HEIGHT : 0)
      const nodes = band.nodes.map((node, row) => ({
        ...node,
        x,
        y: top + row * (NODE_HEIGHT + NODE_GAP),
      }))
      const used = top + band.nodes.length * (NODE_HEIGHT + NODE_GAP) + BAND_GAP
      return {
        bands: [
          ...acc.bands,
          {
            ...(band.value === undefined ? {} : { value: band.value, captionY: acc.cursor + 13 }),
            nodes,
          },
        ],
        cursor: used,
      }
    },
    { bands: [], cursor: HEADER_HEIGHT + 4 }
  )
  return { placed: { index, label: column.label, x, bands }, height: cursor }
}

/** Every placed node, flattened — the lookup the edges are drawn against. */
const nodeIndex = (columns: readonly PlacedColumn[]): ReadonlyMap<string, PlacedNode> =>
  new Map(
    columns.flatMap((column) => column.bands.flatMap((band) => band.nodes)).map((n) => [n.id, n])
  )

/**
 * Join each edge's two endpoints.
 *
 * An edge leaves its source's RIGHT edge and arrives at its target's LEFT edge,
 * which is the reading a left-to-right layered drawing promises. An edge whose
 * target sits in an earlier column therefore doubles back, and is drawn doing
 * so rather than hidden: a grant that runs backwards through the declared
 * columns is a fact about the configuration, not a drawing error.
 *
 * An endpoint the projection did not place cannot occur here — it was dropped
 * one layer up, where a malformed body is absorbed — but the lookup is still
 * guarded, because a geometry pass that throws takes the whole page with it.
 */
const placeEdges = (
  edges: readonly GraphEdgeView[],
  nodes: ReadonlyMap<string, PlacedNode>
): readonly PlacedEdge[] =>
  edges.flatMap((edge) => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (from === undefined || to === undefined) return []
    const path = linkPath({
      source: { x: from.x + COLUMN_WIDTH, y: from.y + NODE_HEIGHT / 2 },
      target: { x: to.x, y: to.y + NODE_HEIGHT / 2 },
    })
    return path === null ? [] : [{ ...edge, path }]
  })

/** Place every column, then every edge, and size the canvas to hold them. */
export const layOutGraph = (
  columns: readonly GraphColumnView[],
  edges: readonly GraphEdgeView[]
): GraphGeometry => {
  const placements = columns.map((column, index) => placeColumn(column, index))
  const placed = placements.map((entry) => entry.placed)
  return {
    columns: placed,
    edges: placeEdges(edges, nodeIndex(placed)),
    width: Math.max(
      COLUMN_WIDTH,
      columns.length * COLUMN_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP
    ),
    height: Math.max(HEADER_HEIGHT, ...placements.map((entry) => entry.height)) + BOTTOM_PADDING,
  }
}
