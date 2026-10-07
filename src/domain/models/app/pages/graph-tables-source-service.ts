/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The graph a `matrix` or `graph` table source builds, from the rows already
 * read for it.
 *
 * The render path reads (each node table through the reader's own gate, each
 * link table the same way, each many-to-many self link from its junction) and
 * hands the rows here; this module turns them into the `{ nodes, edges }`
 * envelope the endpoint arm returns, so both projections read a table-backed
 * graph exactly as they read an endpoint one. It decides nothing about access:
 * a row it is not handed is a node it does not draw, and an edge whose end is
 * not a node is dropped by the projection's own rule ("an edge is drawn if and
 * only if both its endpoints are").
 *
 * A node's id is `<table>:<row id>` unless its entry names an `idField`; every
 * edge end is resolved through the same map, so an edge from a link table and
 * one from a relationship field meet the same node.
 */

import type { DataFilter } from './components/data-source'
import type { GraphTablesSource } from './components/graph-tables-source'

type Row = Readonly<Record<string, unknown>>

/** A relationship field as this module needs it. */
interface RelationshipInfo {
  readonly relatedTable: string
  readonly many: boolean
}

/** The relationship fields of each table: `table -> field -> info`. */
export type RelationshipIndex = ReadonlyMap<string, ReadonlyMap<string, RelationshipInfo>>

/** Everything read for one source, by entry. */
export interface GraphTablesRows {
  /** The rows of each `nodes[]` entry, in entry order. */
  readonly nodeRows: readonly (readonly Row[])[]
  /** The rows of each link-table `edges[]` entry, by its index in `edges`. */
  readonly linkRows: ReadonlyMap<number, readonly Row[]>
  /** For a many-to-many field edge, the ids each row links, by its index in `edges`. */
  readonly fieldLinks: ReadonlyMap<number, ReadonlyMap<string, readonly string[]>>
}

type Edge = NonNullable<GraphTablesSource['edges']>[number]
type LinkEdge = Extract<Edge, { readonly fromField: string }>
type FieldEdge = Extract<Edge, { readonly from: string }>

/** Whether an `edges[]` entry is a link table (the other arm names `from`). */
export const isLinkEdge = (edge: Edge): edge is LinkEdge => 'fromField' in edge

/** The `<table>` and `<field>` of a field edge's `from`. */
export const fieldEdgeParts = (
  edge: FieldEdge
): { readonly table: string; readonly field: string } => {
  const [table = '', field = ''] = edge.from.split('.')
  return { table, field }
}

/** The relationship fields of every table of an app's `tables`. */
export const relationshipIndexOf = (
  tables: readonly { readonly name: string; readonly fields: readonly unknown[] }[] | undefined
): RelationshipIndex =>
  new Map(
    (tables ?? []).map((table) => [
      table.name,
      new Map(
        table.fields.flatMap((field) => {
          const f = field as {
            readonly name?: unknown
            readonly type?: unknown
            readonly relatedTable?: unknown
            readonly relationType?: unknown
          }
          return f.type === 'relationship' &&
            typeof f.name === 'string' &&
            typeof f.relatedTable === 'string'
            ? [[f.name, { relatedTable: f.relatedTable, many: f.relationType === 'many-to-many' }]]
            : []
        })
      ),
    ])
  )

/** The key of a cell value: a relationship holds an id, a number or a string. */
const keyOf = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined

/** The text of a cell value, for a label, a group or a state. */
const textOf = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

/** The text of the cell an optional field key names, when it names one. */
const cellText = (row: Row, field: string | undefined): string | undefined =>
  field === undefined ? undefined : textOf(row[field])

/** A boolean cell as stored: `true`, or a SQLite `1`. */
const isTrue = (value: unknown): boolean => value === true || value === 1 || value === '1'

/** `<table>:<row id>` — the qualified address every edge end resolves through. */
const qualified = (table: string, id: unknown): string => `${table}:${String(id)}`

/** One node of the envelope, read from one row of one entry. */
const nodeOf = (entry: GraphTablesSource['nodes'][number], row: Row): Row => {
  const state = cellText(row, entry.stateField)
  const mapped = state === undefined ? undefined : (entry.stateMap?.[state] ?? state)
  const group = cellText(row, entry.groupField)
  return {
    ...(group === undefined ? {} : { [entry.groupField ?? '']: group }),
    id: cellText(row, entry.idField) ?? qualified(entry.table, row['id']),
    label: textOf(row[entry.labelField]) ?? String(row['id']),
    kind: entry.kind,
    ...(mapped === undefined ? {} : { state: mapped }),
  }
}

/** `<table>:<row id>` → node id, for every node drawn. */
const addressesOf = (
  source: GraphTablesSource,
  rows: GraphTablesRows['nodeRows']
): ReadonlyMap<string, string> =>
  new Map(
    source.nodes.flatMap((entry, index) =>
      (rows[index] ?? []).map((row) => {
        const address = qualified(entry.table, row['id'])
        return [address, cellText(row, entry.idField) ?? address] as const
      })
    )
  )

/** The edges one link table yields. */
const linkEdgesOf = (
  edge: LinkEdge,
  rows: readonly Row[],
  ctx: {
    readonly relationships: RelationshipIndex
    readonly addresses: ReadonlyMap<string, string>
  }
): readonly Row[] => {
  const fields = ctx.relationships.get(edge.table)
  const fromTable = fields?.get(edge.fromField)?.relatedTable
  const toTable = fields?.get(edge.toField)?.relatedTable
  if (fromTable === undefined || toTable === undefined) return []
  return rows.flatMap((row) => {
    const fromKey = keyOf(row[edge.fromField])
    const toKey = keyOf(row[edge.toField])
    if (fromKey === undefined || toKey === undefined) return []
    const from = ctx.addresses.get(qualified(fromTable, fromKey))
    const to = ctx.addresses.get(qualified(toTable, toKey))
    if (from === undefined || to === undefined) return []
    const kind = cellText(row, edge.kindField) ?? edge.kind
    const ops = cellText(row, edge.opsField)
    return [
      {
        id: qualified(edge.table, row['id']),
        from,
        to,
        ...(kind === undefined ? {} : { kind }),
        ...(ops === undefined ? {} : { ops }),
        ...(edge.flagField === undefined ? {} : { flag: isTrue(row[edge.flagField]) }),
      },
    ]
  })
}

/** The edges one relationship field of a node table yields. */
const fieldEdgesOf = (
  edge: FieldEdge,
  ctx: {
    readonly source: GraphTablesSource
    readonly rows: GraphTablesRows
    readonly relationships: RelationshipIndex
    readonly addresses: ReadonlyMap<string, string>
    readonly links: ReadonlyMap<string, readonly string[]> | undefined
  }
): readonly Row[] => {
  const { table, field } = fieldEdgeParts(edge)
  const relatedTable = ctx.relationships.get(table)?.get(field)?.relatedTable
  if (relatedTable === undefined) return []
  const read = ctx.source.nodes.flatMap((entry, index) =>
    entry.table === table ? (ctx.rows.nodeRows[index] ?? []) : []
  )
  const sourceRows = read.filter(
    (row, index) => read.findIndex((other) => String(other['id']) === String(row['id'])) === index
  )
  return sourceRows.flatMap((row) => {
    const rowId = String(row['id'])
    const from = ctx.addresses.get(qualified(table, rowId))
    if (from === undefined) return []
    const targets = ctx.links?.get(rowId) ?? [keyOf(row[field])].filter((k) => k !== undefined)
    return targets.flatMap((target) => {
      const to = ctx.addresses.get(qualified(relatedTable, target))
      if (to === undefined) return []
      return [
        {
          id: `${edge.from}:${rowId}:${target}`,
          from,
          to,
          ...(edge.kind === undefined ? {} : { kind: edge.kind }),
        },
      ]
    })
  })
}

/**
 * The `{ nodes, edges }` envelope of one table source, from the rows read for
 * it. A row read twice (two entries over one table) is one node, the first.
 */
export const buildGraphTablesEnvelope = (
  source: GraphTablesSource,
  rows: GraphTablesRows,
  relationships: RelationshipIndex
): { readonly nodes: readonly Row[]; readonly edges: readonly Row[] } => {
  const addresses = addressesOf(source, rows.nodeRows)
  const allNodes = source.nodes.flatMap((entry, index) =>
    (rows.nodeRows[index] ?? []).map((row) => nodeOf(entry, row))
  )
  const nodes = allNodes.filter(
    (node, index) => allNodes.findIndex((other) => other['id'] === node['id']) === index
  )
  const edges = (source.edges ?? []).flatMap((edge, index) =>
    isLinkEdge(edge)
      ? linkEdgesOf(edge, rows.linkRows.get(index) ?? [], { relationships, addresses })
      : fieldEdgesOf(edge, {
          source,
          rows,
          relationships,
          addresses,
          links: rows.fieldLinks.get(index),
        })
  )
  return { nodes, edges }
}

/** A view condition operator, in the page data-source vocabulary. */
const OPERATOR_TRANSLATION: Readonly<Record<string, DataFilter['operator']>> = {
  equals: 'eq',
  notEquals: 'neq',
  greaterThan: 'gt',
  lessThan: 'lt',
  greaterThanOrEqual: 'gte',
  lessThanOrEqual: 'lte',
  contains: 'contains',
  in: 'in',
  isEmpty: 'isEmpty',
  isNotEmpty: 'isNotEmpty',
  isNull: 'isEmpty',
  isNotNull: 'isNotEmpty',
}

/** One view condition as a page data filter, or `undefined` when it has no translation. */
const conditionFilter = (node: unknown): DataFilter | undefined => {
  if (typeof node !== 'object' || node === null) return undefined
  const { field, operator, value } = node as {
    readonly field?: unknown
    readonly operator?: unknown
    readonly value?: unknown
  }
  if (typeof field !== 'string' || typeof operator !== 'string') return undefined
  if (operator === 'isTrue' || operator === 'isFalse') {
    return { field, operator: 'eq', value: operator === 'isTrue' }
  }
  const translated = OPERATOR_TRANSLATION[operator]
  if (translated === undefined) return undefined
  return translated === 'isEmpty' || translated === 'isNotEmpty'
    ? { field, operator: translated }
    : ({ field, operator: translated, value } as DataFilter)
}

/**
 * A view's `filters` as the page data filters the records gate reads, ANDed —
 * or `undefined` when the view holds a condition with no translation (an `or`
 * group, `startsWith`, …). The caller then draws the entry as unavailable
 * rather than draw rows the view would have kept out.
 */
export const viewFiltersAsDataFilters = (filters: unknown): readonly DataFilter[] | undefined => {
  if (filters === undefined || filters === null) return []
  const conditions: readonly unknown[] =
    typeof filters === 'object' && 'and' in filters && Array.isArray(filters.and)
      ? filters.and
      : Array.isArray(filters)
        ? filters
        : [filters]
  const translated = conditions.map(conditionFilter)
  return translated.every((filter) => filter !== undefined)
    ? (translated as readonly DataFilter[])
    : undefined
}
