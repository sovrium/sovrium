/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The twin rows of a projected graph: one row per node, listing what it
 * reaches, so the drawing has a readable table beside it.
 */

import type {
  GraphNodeView,
  GraphColumnView,
  GraphLanesView,
  GraphEdgeView,
  GraphTwinRowView,
} from './graph-view'

/**
 * What a node reaches DIRECTLY, by label — the edges of one drawing, as text,
 * each led by its kind when it has one (`depends Ledger`). Direct rather than
 * transitive because the criterion is that "the edges exist as text, not only
 * as lines": a transitive closure would be the island's reach SET.
 *
 * Closed over once per projection rather than passed down as an `edges` +
 * `labels` pair: every caller asks the same question about a different node.
 */
type Reach = (id: string) => readonly string[]

export const reachOver =
  (edges: readonly GraphEdgeView[], labels: ReadonlyMap<string, string>): Reach =>
  (id) =>
    edges
      .filter((edge) => edge.from === id)
      .map((edge) => `${edge.kind} ${labels.get(edge.to) ?? edge.to}`.trim())

const twinRow = (
  node: GraphNodeView,
  columnLabel: string,
  band: string | undefined,
  reach: Reach
): GraphTwinRowView => ({
  id: node.id,
  label: node.label,
  kind: node.kind,
  columnLabel,
  ...(band === undefined ? {} : { band }),
  ...(node.detail === undefined ? {} : { detail: node.detail }),
  ...(node.flag === undefined ? {} : { flag: node.flag }),
  reaches: reach(node.id),
})

export const twinRowsOf = (
  columns: readonly GraphColumnView[],
  reach: Reach
): readonly GraphTwinRowView[] =>
  columns.flatMap((column) =>
    column.bands.flatMap((band) =>
      band.nodes.map((node) => twinRow(node, column.label, band.value, reach))
    )
  )

/**
 * One twin row per drawn node of a lanes drawing — a lane, then its stations.
 *
 * The twin's SHAPE does not change between the two layouts, which is the
 * property worth keeping: `Column` names the track a node sits in — the spine
 * heading for a lane, the station heading for a station — and `Group` names the
 * lane a station belongs to. Without that group cell a station's row is a bare
 * action name with nothing saying which mechanism runs it, and the eight rows
 * read as one undifferentiated list.
 *
 * A LANE's row carries no group, and that is not an omission: its own `Node`
 * cell already names the lane, so a group would say the same word twice on one
 * row.
 */
export const laneTwinRowsOf = (lanes: GraphLanesView, reach: Reach): readonly GraphTwinRowView[] =>
  lanes.rows.flatMap((row) => [
    twinRow(row.node, lanes.label, undefined, reach),
    ...row.stations.map((station) => twinRow(station, lanes.stationLabel, row.node.label, reach)),
  ])
