/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Two tables whose computed fields read each other cannot both be computed.
 *
 * A table with a lookup, rollup or count field is served through a view that
 * computes them, and that view reads the RELATED table through the related
 * table's own view. When the related table's view reads this one back — say
 * `projects.note_titles` lists the notes that point at a project while
 * `notes.project_title` copies the title of the project a note points at —
 * each view is defined in terms of the other. The database refuses that at
 * start-up (« view projects is circularly defined » on SQLite, « relation
 * "notes" does not exist » on PostgreSQL), long after the config was accepted.
 * This check refuses it when the config is read instead, naming the fields.
 *
 * A link to the table's own rows is not a cycle: such a view reads its own
 * stored rows, never itself.
 */

/** The slice of a field this check reads. */
interface FieldLike {
  readonly name: string
  readonly type: string
  readonly relationshipField?: string
  readonly relatedTable?: string
}

/** The slice of a table this check reads. */
interface TableLike {
  readonly name: string
  readonly fields: readonly FieldLike[]
}

/** One computed field of `table` that reads `reads`, through `link`. */
interface ViewEdge {
  readonly table: string
  readonly field: string
  readonly reads: string
  /** `<table>.<relationship field>` — the relationship the field goes through. */
  readonly link: string
}

const COMPUTED_TYPES: ReadonlySet<string> = new Set(['lookup', 'rollup', 'count'])

/** A table served through a view: it has a lookup, a rollup or a count. */
const isViewBacked = (table: TableLike): boolean =>
  table.fields.some((field) => COMPUTED_TYPES.has(field.type))

/**
 * The table a computed field reads, and the relationship it goes through: this
 * table's own relationship, or — for a lookup — the related table's link back.
 */
const edgeOf = (
  table: TableLike,
  field: FieldLike,
  tables: readonly TableLike[]
): ViewEdge | undefined => {
  const own = table.fields.find(
    (candidate) => candidate.name === field.relationshipField && candidate.type === 'relationship'
  )
  if (own?.relatedTable !== undefined) {
    return {
      table: table.name,
      field: field.name,
      reads: own.relatedTable,
      link: `${table.name}.${own.name}`,
    }
  }
  if (field.type !== 'lookup') return undefined
  const back = tables.find(
    (other) =>
      other.name !== table.name &&
      other.fields.some(
        (candidate) =>
          candidate.name === field.relationshipField && candidate.type === 'relationship'
      )
  )
  return back === undefined
    ? undefined
    : {
        table: table.name,
        field: field.name,
        reads: back.name,
        link: `${back.name}.${field.relationshipField ?? ''}`,
      }
}

/** Every edge from one view to ANOTHER table's view. */
const viewEdges = (tables: readonly TableLike[]): readonly ViewEdge[] => {
  const viewBacked = new Set(tables.filter(isViewBacked).map((table) => table.name))
  return tables
    .filter((table) => viewBacked.has(table.name))
    .flatMap((table) =>
      table.fields
        .filter((field) => COMPUTED_TYPES.has(field.type))
        .flatMap((field) => {
          const edge = edgeOf(table, field, tables)
          return edge !== undefined && edge.reads !== table.name && viewBacked.has(edge.reads)
            ? [edge]
            : []
        })
    )
}

/** What a depth-first walk carries: the tables fully explored, and the cycle once found. */
interface Walk {
  readonly done: ReadonlySet<string>
  readonly cycle?: readonly ViewEdge[]
}

/** The edges from the walk's first table to the current one, and the tables they pass. */
interface Trail {
  readonly edges: readonly ViewEdge[]
  readonly tables: readonly string[]
}

/**
 * Walk depth-first from `node`, which `trail` leads to from its first table. A table fully explored is never walked again, so the
 * walk is linear in the edges — enumerating every PATH instead is exponential
 * on a config where each table looks up two others.
 */
const walkFrom = (
  node: string,
  trail: Trail,
  outgoing: ReadonlyMap<string, readonly ViewEdge[]>,
  walk: Walk
): Walk => {
  const explored = (outgoing.get(node) ?? []).reduce<Walk>((state, edge) => {
    if (state.cycle !== undefined || state.done.has(edge.reads)) return state
    const onTrail = trail.tables.indexOf(edge.reads)
    if (onTrail !== -1) return { ...state, cycle: [...trail.edges.slice(onTrail), edge] }
    return walkFrom(
      edge.reads,
      { edges: [...trail.edges, edge], tables: [...trail.tables, edge.reads] },
      outgoing,
      state
    )
  }, walk)
  return explored.cycle !== undefined ? explored : { done: new Set([...explored.done, node]) }
}

/** The first cycle of views reading each other, as the edges that close it. */
export const findLookupCycle = (tables: readonly TableLike[]): readonly ViewEdge[] | undefined => {
  const outgoing = viewEdges(tables).reduce<ReadonlyMap<string, readonly ViewEdge[]>>(
    (map, edge) => new Map([...map, [edge.table, [...(map.get(edge.table) ?? []), edge]]]),
    new Map()
  )
  return tables.reduce<Walk>(
    (walk, table) =>
      walk.cycle !== undefined || walk.done.has(table.name)
        ? walk
        : walkFrom(table.name, { edges: [], tables: [table.name] }, outgoing, walk),
    { done: new Set() }
  ).cycle
}

/** `a`, `a and b`, `a, b and c`. */
const listed = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`

/** The message naming a cycle's fields and the relationships they go through. */
export const lookupCycleMessage = (cycle: readonly ViewEdge[]): string => {
  const fields = listed(cycle.map((edge) => `\`${edge.table}.${edge.field}\``))
  const links = [...new Set(cycle.map((edge) => `\`${edge.link}\``))]
  const through = links.length === 1 ? ` through ${links[0]}` : ` through ${listed(links)}`
  return `${fields} look each other up${through}; a lookup cannot read a lookup that reads it back`
}

/**
 * `true` when no two tables' computed fields read each other, else the message
 * naming the cycle.
 */
export const validateNoLookupCycle = (tables: readonly TableLike[]): true | string => {
  const cycle = findLookupCycle(tables)
  return cycle === undefined ? true : lookupCycleMessage(cycle)
}
