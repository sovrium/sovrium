/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The table-and-view arm of a `matrix` or `graph` data source: a graph built
 * from the app's own records instead of read from an endpoint.
 *
 * ─── WHAT A TABLE-BACKED GRAPH MEANS ──────────────────────────────────────
 *
 * The endpoint arm stayed alone until this question had an answer, because a
 * table on its own says nothing about which rows are nodes and which connect
 * them. The answer is that the AUTHOR says it, once, in two lists:
 *
 *  - `nodes[]` — each entry names a table (optionally narrowed by one of its
 *    views) whose rows become nodes of one `kind`. The `kind` is the same open
 *    string a node of the endpoint arm carries, so `columns[].kinds`,
 *    `rows.kinds` and `lanes` read a table-backed graph exactly as they read an
 *    endpoint one.
 *  - `edges[]` — each entry is EITHER a link table (one row per edge, with a
 *    `fromField` and a `toField` pointing at node rows) OR a relationship field
 *    already on a node table (`from: tasks.depends_on`), which is the common
 *    case and needs no second table at all.
 *
 * Every name here is a TABLE OR FIELD NAME of the app, resolved against
 * `app.tables` when the config is read, so a typo is a validation error rather
 * than an empty drawing.
 *
 * ─── WHY THE NODE ID IS OPTIONAL ──────────────────────────────────────────
 *
 * A row's `id` is unique within its table, not across two tables, so the
 * engine qualifies it (`<table>:<id>`) unless `idField` names a field already
 * unique across the graph (a code, a slug). Edges from a link table and from a
 * relationship field resolve through the same qualification, so the two kinds
 * of edge meet the same nodes.
 */

import { Schema } from 'effect'

const nonEmpty = (description: string, examples?: readonly [string, ...string[]]) =>
  Schema.String.pipe(
    Schema.annotate(examples === undefined ? { description } : { description, examples }),
    Schema.check(Schema.isMinLength(1))
  )

export const GraphTablesNodeSchema = Schema.Struct({
  table: nonEmpty('Table whose rows become nodes of this kind', ['services', 'teams']),
  view: Schema.optional(
    Schema.String.annotate({
      description: 'A view of that table narrowing which rows become nodes',
    })
  ),
  kind: nonEmpty(
    'Kind of every node this entry yields — the string columns, rows and lanes select nodes by',
    ['service', 'team']
  ),
  idField: Schema.optional(
    Schema.String.annotate({
      description:
        'A field unique across the whole graph to identify each node by. Omitted, the row id is qualified by its table.',
    })
  ),
  labelField: nonEmpty('Field whose value names each node', ['name']),
  groupField: Schema.optional(
    Schema.String.annotate({
      description: 'Field a column or an axis may group these nodes by (its `groupBy` names it)',
    })
  ),
  stateField: Schema.optional(
    Schema.String.annotate({
      description: 'Field holding each node’s state, drawn as its status mark',
    })
  ),
  stateMap: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      description:
        'Maps a value of `stateField` to the state word the drawing knows (for example `{ Live: ok, Down: failed }`). Values with no entry are drawn as they are.',
    })
  ),
}).annotate({
  identifier: 'GraphTablesNode',
  title: 'Graph Tables Node',
  description: 'One table (or view) whose rows become nodes of one kind',
})

export const GraphTablesLinkEdgeSchema = Schema.Struct({
  table: nonEmpty('Link table with one row per edge', ['service_dependencies']),
  fromField: nonEmpty('Relationship field of the link table pointing at the edge’s source node'),
  toField: nonEmpty('Relationship field of the link table pointing at the edge’s target node'),
  kind: Schema.optional(
    Schema.String.annotate({
      description:
        'Kind given to every edge of this link table, when no kindField varies it per row',
    })
  ),
  kindField: Schema.optional(
    Schema.String.annotate({ description: 'Field holding each edge’s kind' })
  ),
  opsField: Schema.optional(
    Schema.String.annotate({
      description: 'Field holding the operations an edge grants, read by a matrix `cell.opsField`',
    })
  ),
  flagField: Schema.optional(
    Schema.String.annotate({
      description: 'Boolean field marking an edge for a matrix `cell.flag`',
    })
  ),
}).annotate({
  identifier: 'GraphTablesLinkEdge',
  title: 'Graph Tables Link Edge',
  description: 'Edges read from a link table: one row per edge, from one node to another',
})

export const GraphTablesFieldEdgeSchema = Schema.Struct({
  from: Schema.String.pipe(
    Schema.annotate({
      description:
        'A relationship field of a node table, as `<table>.<field>`: every link it holds becomes an edge from the row to the record it points at',
      examples: ['tasks.depends_on', 'teams.parent'],
    }),
    Schema.check(Schema.isPattern(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/))
  ),
  kind: Schema.optional(
    Schema.String.annotate({ description: 'Kind given to every edge this field yields' })
  ),
}).annotate({
  identifier: 'GraphTablesFieldEdge',
  title: 'Graph Tables Field Edge',
  description: 'Edges read from a relationship field already on a node table',
})

export const GraphTablesSourceSchema = Schema.Struct({
  nodes: Schema.Array(GraphTablesNodeSchema).pipe(
    Schema.annotate({ description: 'The tables whose rows are the graph’s nodes; at least one' }),
    Schema.check(Schema.isMinLength(1))
  ),
  edges: Schema.optional(
    Schema.Array(Schema.Union([GraphTablesLinkEdgeSchema, GraphTablesFieldEdgeSchema])).annotate({
      description:
        'Where the edges come from: link tables, relationship fields of the node tables, or both',
    })
  ),
}).annotate({
  identifier: 'GraphTablesSource',
  title: 'Graph Tables Source',
  description:
    'A graph built from the app’s own tables: nodes from tables or views, edges from link tables or relationship fields',
})

export type GraphTablesSource = Schema.Schema.Type<typeof GraphTablesSourceSchema>
