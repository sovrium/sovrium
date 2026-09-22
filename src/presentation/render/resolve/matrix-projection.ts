/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turn ONE graph read into the drawing a `matrix` renders.
 *
 * ─── WHAT THIS MODULE MAY KNOW, AND WHAT IT MAY NOT ────────────────────────
 *
 * It knows the ENVELOPE's structure — a node has an `id` and a `label`, an edge
 * has a `from` and a `to` — because that is what makes a graph a graph. It
 * knows nothing else: `kind`, `family`, `level`, `ops`, `viaOpenRung` are the
 * bound endpoint's own words and reach this file only as the OPEN STRINGS the
 * author wrote in `rows.kinds`, `groupBy`, `sortBy`, `cell.opsField` and
 * `flag.field`. A second endpoint with a different vocabulary draws here
 * unchanged, which is the whole reason the schema left those keys open.
 *
 * ─── THE DEGRADATION LADDER LIVES HERE ─────────────────────────────────────
 *
 * `cell.glyph` names the PRIMARY rendering, not a promise. A real grid draws
 * more than one mark because the glyph follows the OPS SHAPE:
 *
 *   1. ops the declared glyph CAN express  -> drawn in it;
 *   2. ops it cannot                       -> `ops-label`, letters printed
 *      rather than dropped (dropping them would make an `RW` grant and an `AI`
 *      grant the same mark);
 *   3. a matching edge carrying NO ops     -> `filled` — connected, nothing
 *      further claimed.
 *
 * {@link MATRIX_QUADRANT_CORNERS} is the fourth thing it knows, and it is a
 * RENDERER CONSTANT rather than config: an author who could re-map the corners
 * could ship a grid whose legend and glyphs disagree.
 *
 * ─── AND WHY THE CEILING IS A PRODUCT ──────────────────────────────────────
 *
 * `system-rows-template-resolver.ts` caps its expansion at 1000 rows because a
 * server-rendered row inlines the endpoint's corpus into the HTML. A matrix
 * inlines rows x COLUMNS, so the same cliff is reached far earlier and from a
 * config an author cannot read a size off. See {@link MAX_MATRIX_ROWS}.
 *
 * @see ./matrix-graph-resolver.ts — the render-path read that feeds this
 * @see src/presentation/render/registry/matrix-component.tsx — the drawing
 */

import type {
  MatrixAxis,
  MatrixCell,
  MatrixCellFlag,
  MatrixGlyph,
} from '@/domain/models/app/pages/components/component-types/data/matrix'

/** One record of the bound envelope — a node or an edge, read loosely. */
type GraphRecord = Readonly<Record<string, unknown>>

/**
 * Hard ceilings on the axes, and therefore on the cell count.
 *
 * 150 rows x 40 columns is 6,000 cells. An EMPTY cell is roughly 85 bytes of
 * markup and a populated quadrant roughly four times that, so the ceiling is a
 * ~0.5 MB document — deliberately a cliff-guard rather than a target. The
 * motivating shape is real: a 200-resource instance against 40 grant sources is
 * 8,000 cells, which this refuses to draw whole and says so
 * ({@link MatrixGridView.truncated}) rather than shipping silently.
 */
export const MAX_MATRIX_ROWS = 150

/** @see MAX_MATRIX_ROWS — the other half of the product. */
export const MAX_MATRIX_COLUMNS = 40

/**
 * The quadrant's four corners, in the reading order of a two-column grid:
 * R top-left, C top-right, U bottom-left, D bottom-right.
 *
 * A RENDERER CONSTANT, deliberately not config. It is also what decides which
 * ops shapes `quadrant` can express at all — a letter with no corner has
 * nowhere to sit, which is rung 2 of the ladder above.
 */
export const MATRIX_QUADRANT_CORNERS = ['R', 'C', 'U', 'D'] as const

/** One lit-or-unlit corner of a drawn quadrant. */
export interface MatrixCorner {
  readonly letter: string
  readonly lit: boolean
}

/** One intersection, populated or not. */
export interface MatrixCellView {
  /** `<rowId>:<columnId>` — the DOM contract's cell address. */
  readonly key: string
  /** The glyph ACTUALLY drawn, after the ladder. Absent on an empty cell. */
  readonly glyph?: MatrixGlyph
  readonly ops?: string
  readonly flagged: boolean
  readonly flagLabel?: string
  readonly corners?: readonly MatrixCorner[]
}

/** One admitted node on an axis. */
export interface MatrixAxisEntry {
  readonly id: string
  readonly label: string
}

export interface MatrixRowView extends MatrixAxisEntry {
  readonly cells: readonly MatrixCellView[]
}

/** One band of rows sharing a `rows.groupBy` value; `value` absent when ungrouped. */
export interface MatrixRowGroupView {
  readonly value?: string
  readonly rows: readonly MatrixRowView[]
}

/**
 * One band of columns sharing a `columns.groupBy` value; `value` absent when
 * ungrouped — which is also the shape an ungrouped axis takes, as ONE unnamed
 * band holding every column. The renderer therefore draws bands and never a
 * bare strip, so there is one path through the header rather than two.
 *
 * `MatrixAxisSchema` is one type reused for both axes, so `groupBy` was always
 * declarable here; it simply had nothing to produce. This is its half.
 */
export interface MatrixColumnGroupView {
  readonly value?: string
  readonly columns: readonly MatrixAxisEntry[]
}

/** One row of the accessible twin — resource, grant source, ops, flag. */
export interface MatrixTwinRowView {
  readonly rowLabel: string
  readonly columnLabel: string
  readonly ops?: string
  readonly flagLabel?: string
}

export interface MatrixGridView {
  readonly kind: 'grid'
  /**
   * Every column, flattened in the order the bands put them in.
   *
   * Load-bearing, and the reason the flat list is DERIVED from the bands rather
   * than sitting beside them: a cell is addressed by its POSITION in this array
   * (`rowViews` builds one cell per entry, the twin reads `columns[index]`), so
   * a band order that disagreed with it would slide every glyph out from under
   * the heading naming it.
   */
  readonly columns: readonly MatrixAxisEntry[]
  readonly columnGroups: readonly MatrixColumnGroupView[]
  readonly groups: readonly MatrixRowGroupView[]
  readonly twinRows: readonly MatrixTwinRowView[]
  readonly degraded: readonly string[]
  readonly truncated: boolean
}

/**
 * The four reads a matrix can meet, and they are deliberately four.
 *
 *  - `grid`        — axes resolved. A grid with no populated cell is SPARSE and
 *    still a grid: a resource nobody has been granted is a finding, not a blank.
 *  - `empty`       — the read succeeded and an axis admits nothing. No geometry
 *    to draw, so `emptyMessage` renders instead.
 *  - `unavailable` — the read did not succeed for this caller. A grid claiming
 *    zero grants must not be drawn.
 */
export type MatrixView =
  | MatrixGridView
  | { readonly kind: 'empty'; readonly degraded: readonly string[] }
  | { readonly kind: 'unavailable' }

/** The declaration this projection reads, lifted off the component. */
export interface MatrixProjectionConfig {
  readonly rows?: MatrixAxis
  readonly columns?: MatrixAxis
  readonly cell?: MatrixCell
  readonly nodesKey?: string
  readonly edgesKey?: string
}

const DEFAULT_NODES_KEY = 'nodes'
const DEFAULT_EDGES_KEY = 'edges'
const DEFAULT_GLYPH: MatrixGlyph = 'filled'

/** A non-empty string field, or nothing. Absence has one spelling here. */
const text = (record: GraphRecord, key: string): string | undefined => {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** An array of records under `key`, or none — a missing collection is not an error. */
const collection = (envelope: GraphRecord, key: string): readonly GraphRecord[] => {
  const value = envelope[key]
  return Array.isArray(value) ? (value as readonly GraphRecord[]) : []
}

/** The envelope's own `degraded[]`, kept as the strings the endpoint named. */
export const degradedSources = (envelope: GraphRecord): readonly string[] => {
  const value = envelope['degraded']
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/** Nodes this axis admits. An absent `kinds` admits every node the graph returned. */
const admit = (
  nodes: readonly GraphRecord[],
  axis: MatrixAxis | undefined
): readonly GraphRecord[] =>
  axis?.kinds === undefined
    ? nodes
    : nodes.filter((node) => {
        const kind = text(node, 'kind')
        return kind !== undefined && axis.kinds?.includes(kind) === true
      })

const compareValues = (left: unknown, right: unknown): number =>
  typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right))

/**
 * Order an axis by `sortBy`, in `sortDirection`.
 *
 * A node that does not CARRY the field keeps its source order AFTER those that
 * do — the schema's own wording. It is what puts the open rung last on the
 * console's column axis: it ranks on no ladder, so it can neither sort among
 * the levelled columns nor be dropped.
 */
const order = (
  nodes: readonly GraphRecord[],
  axis: MatrixAxis | undefined
): readonly GraphRecord[] => {
  const key = axis?.sortBy
  if (key === undefined) return nodes
  const direction = axis?.sortDirection === 'desc' ? -1 : 1
  const carried = nodes.filter((node) => node[key] !== undefined && node[key] !== null)
  const uncarried = nodes.filter((node) => node[key] === undefined || node[key] === null)
  return [
    ...carried.toSorted((left, right) => direction * compareValues(left[key], right[key])),
    ...uncarried,
  ]
}

/** Admitted, ordered, capped, and reduced to what the drawing needs. */
const axisEntries = (
  nodes: readonly GraphRecord[],
  axis: MatrixAxis | undefined,
  cap: number
): readonly GraphRecord[] => order(admit(nodes, axis), axis).slice(0, cap)

/**
 * The edge filling this intersection, if any.
 *
 * Endpoint-agnostic on DIRECTION: an edge whose two ends ARE this pair fills
 * the cell whichever way round it points. The one shipped consumer draws its
 * grants source -> resource, i.e. column -> row, and a platform that hard-coded
 * that would refuse the first endpoint that spells it the other way.
 */
const edgeBetween = (
  edges: readonly GraphRecord[],
  rowId: string,
  columnId: string,
  kind: string | undefined
): GraphRecord | undefined =>
  edges.find((edge) => {
    if (kind !== undefined && text(edge, 'kind') !== kind) return false
    const from = text(edge, 'from')
    const to = text(edge, 'to')
    return (from === rowId && to === columnId) || (from === columnId && to === rowId)
  })

/** Whether the declared glyph has somewhere to put every letter of this shape. */
const canExpress = (glyph: MatrixGlyph, ops: string): boolean =>
  glyph !== 'quadrant' ||
  [...ops].every((letter) => (MATRIX_QUADRANT_CORNERS as readonly string[]).includes(letter))

/** Rungs 1-3 of the ladder, in that order. */
const drawnGlyph = (declared: MatrixGlyph, ops: string): MatrixGlyph =>
  ops.length === 0 ? 'filled' : canExpress(declared, ops) ? declared : 'ops-label'

const cornersFor = (ops: string): readonly MatrixCorner[] =>
  MATRIX_QUADRANT_CORNERS.map((letter) => ({ letter, lit: ops.includes(letter) }))

/** The flag's own word, when this edge carries the declared field as `true`. */
const flagOf = (edge: GraphRecord, flag: MatrixCellFlag | undefined): string | undefined =>
  flag !== undefined && edge[flag.field] === true ? flag.label : undefined

const emptyCell = (rowId: string, columnId: string): MatrixCellView => ({
  key: `${rowId}:${columnId}`,
  flagged: false,
})

/** One populated intersection, after the ladder has chosen its mark. */
const populatedCell = (
  rowId: string,
  columnId: string,
  edge: GraphRecord,
  cell: MatrixCell | undefined
): MatrixCellView => {
  const ops = (cell?.opsField === undefined ? undefined : text(edge, cell.opsField)) ?? ''
  const glyph = drawnGlyph(cell?.glyph ?? DEFAULT_GLYPH, ops)
  const flagLabel = flagOf(edge, cell?.flag)
  return {
    key: `${rowId}:${columnId}`,
    glyph,
    flagged: flagLabel !== undefined,
    ...(ops.length === 0 ? {} : { ops }),
    ...(flagLabel === undefined ? {} : { flagLabel }),
    ...(glyph === 'quadrant' ? { corners: cornersFor(ops) } : {}),
  }
}

/**
 * The per-id `groupBy` value for one axis's nodes.
 *
 * An axis declaring no `groupBy` maps every id to `undefined`, which is what
 * collapses the banding below into a single unnamed band — so "ungrouped" is
 * one end of the grouped case rather than a branch of its own.
 */
const groupValuesOf = (
  nodes: readonly GraphRecord[],
  axis: MatrixAxis | undefined
): ReadonlyMap<string, string | undefined> =>
  new Map(
    nodes.map((node) => [
      text(node, 'id') ?? '',
      axis?.groupBy === undefined ? undefined : text(node, axis.groupBy),
    ])
  )

/** Band the rows by a node field. One band per distinct value, in row order. */
const groupRows = (
  rows: readonly MatrixRowView[],
  values: ReadonlyMap<string, string | undefined>
): readonly MatrixRowGroupView[] => {
  const distinct = [...new Set(rows.map((row) => values.get(row.id)))]
  return distinct.map((value) => ({
    ...(value === undefined ? {} : { value }),
    rows: rows.filter((row) => values.get(row.id) === value),
  }))
}

/**
 * Band the columns by a node field — {@link groupRows} for the other axis, and
 * deliberately its mirror rather than a generalisation of it: the two bands hold
 * different things (`rows` / `columns`) and the shared part is one `Set`.
 *
 * Column order WITHIN a band is axis order, so `sortBy` keeps working inside
 * each band; the bands themselves come in first-appearance order along the axis.
 * A node not carrying the field lands in the unnamed band, exactly as a row does.
 */
const groupColumns = (
  columns: readonly MatrixAxisEntry[],
  values: ReadonlyMap<string, string | undefined>
): readonly MatrixColumnGroupView[] => {
  const distinct = [...new Set(columns.map((column) => values.get(column.id)))]
  return distinct.map((value) => ({
    ...(value === undefined ? {} : { value }),
    columns: columns.filter((column) => values.get(column.id) === value),
  }))
}

/** The twin enumerates POPULATED cells only, in the order the grid draws them. */
const twinRowsOf = (
  groups: readonly MatrixRowGroupView[],
  columns: readonly MatrixAxisEntry[]
): readonly MatrixTwinRowView[] =>
  groups.flatMap((group) =>
    group.rows.flatMap((row) =>
      row.cells.flatMap((cell, index) =>
        cell.glyph === undefined
          ? []
          : [
              {
                rowLabel: row.label,
                columnLabel: columns[index]?.label ?? '',
                ...(cell.ops === undefined ? {} : { ops: cell.ops }),
                ...(cell.flagLabel === undefined ? {} : { flagLabel: cell.flagLabel }),
              },
            ]
      )
    )
  )

const rowViews = (
  rowNodes: readonly GraphRecord[],
  columns: readonly MatrixAxisEntry[],
  edges: readonly GraphRecord[],
  cell: MatrixCell | undefined
): readonly MatrixRowView[] =>
  rowNodes.map((node) => {
    const id = text(node, 'id') ?? ''
    return {
      id,
      label: text(node, 'label') ?? id,
      cells: columns.map((column) => {
        const edge = edgeBetween(edges, id, column.id, cell?.kind)
        return edge === undefined
          ? emptyCell(id, column.id)
          : populatedCell(id, column.id, edge, cell)
      }),
    }
  })

const entryOf = (node: GraphRecord): MatrixAxisEntry => {
  const id = text(node, 'id') ?? ''
  return { id, label: text(node, 'label') ?? id }
}

/**
 * Project the envelope into the view the renderer draws.
 *
 * `empty` and `grid` are told apart by GEOMETRY alone: an axis admitting
 * nothing has nothing to draw, while axes that resolve and cells that do not
 * are a SPARSE grid and still a grid.
 */
export const projectMatrix = (
  envelope: GraphRecord,
  config: MatrixProjectionConfig
): MatrixView => {
  const nodes = collection(envelope, config.nodesKey ?? DEFAULT_NODES_KEY)
  const edges = collection(envelope, config.cell?.from ?? config.edgesKey ?? DEFAULT_EDGES_KEY)
  const degraded = degradedSources(envelope)
  const rowNodes = axisEntries(nodes, config.rows, MAX_MATRIX_ROWS)
  const columnNodes = axisEntries(nodes, config.columns, MAX_MATRIX_COLUMNS)
  if (rowNodes.length === 0 || columnNodes.length === 0) return { kind: 'empty', degraded }

  // The column bands are resolved BEFORE the cells, because they decide the
  // column order and the cells are positional against it.
  const columnGroups = groupColumns(
    columnNodes.map(entryOf),
    groupValuesOf(columnNodes, config.columns)
  )
  const columns = columnGroups.flatMap((group) => group.columns)
  const rows = rowViews(rowNodes, columns, edges, config.cell)
  const groups = groupRows(rows, groupValuesOf(rowNodes, config.rows))
  return {
    kind: 'grid',
    columns,
    columnGroups,
    groups,
    twinRows: twinRowsOf(groups, columns),
    degraded,
    truncated:
      admit(nodes, config.rows).length > rowNodes.length ||
      admit(nodes, config.columns).length > columns.length,
  }
}
