/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `?node=<id>` — narrowing the access graph to one SUBJECT.
 *
 * Not a sixth lens: the parameter does not choose a projection, and every lens
 * draws the narrowed graph exactly the way it draws the whole one. It chooses
 * who the question is about.
 *
 * ─── WHAT SURVIVES ──────────────────────────────────────────────────────────
 *
 * The named node, everything it REACHES, and everything that REACHES it — its
 * descendants and its ancestors in the directed graph — plus the edges whose two
 * endpoints both survive. Narrowing to `invoices` therefore keeps every grant
 * source that leads to it and every principal standing in one of those sources,
 * because those are what EXPLAIN the subject; a filter that returned the node
 * alone would be narrower still and would answer nothing.
 *
 * Filtering nodes without filtering edges is the one failure mode worth naming:
 * it leaves an edge pointing at an id that is no longer in `nodes`, which a lens
 * renders as a silently missing relationship rather than as an error. The
 * referential invariant is therefore re-established here rather than assumed.
 *
 * ─── WHAT DOES NOT ──────────────────────────────────────────────────────────
 *
 * `findings` and `degraded` are untouched, and that is the caller's job rather
 * than this module's — it is handed only the three collections that ARE facts
 * about the subject. A findings list that shrank when an operator clicked a
 * person would be reporting that the exposure went away, and `degraded` reports
 * the READ's health, not the node's.
 *
 * ─── COST ───────────────────────────────────────────────────────────────────
 *
 * A fold over a graph already in memory, so a narrowed read costs exactly what
 * the whole one costs. The tempting implementation — "fetch this principal's
 * memberships" — is a fourth query the endpoint's cost bound forbids, and would
 * reintroduce per-principal work through the one door the original design left
 * open.
 *
 * ─── AN UNKNOWN ID ──────────────────────────────────────────────────────────
 *
 * Yields an empty graph, never a 404. This route already answers 404 to a caller
 * without the admin tier, so a second meaning for that status would leave a
 * client unable to tell "you may not read this" from "no such node" — and
 * between an admin and the ids inside their own configuration there is nothing
 * to enumerate. It falls out of the fold rather than being special-cased: an id
 * that names no node has no ancestors and no descendants, and is itself filtered
 * out of an empty `nodes`.
 *
 * @see src/application/use-cases/admin/organisation-graph.ts (the assembly)
 * @see src/domain/models/api/admin/organisation/graph.ts (the wire contract)
 */

import type {
  AdminOrganisationGraphEdge,
  AdminOrganisationGraphException,
  AdminOrganisationGraphNode,
} from '@/domain/models/api/admin/organisation/graph'

/** The three collections that are facts ABOUT a node, and therefore narrowable. */
export interface NarrowableGraph {
  readonly nodes: readonly AdminOrganisationGraphNode[]
  readonly edges: readonly AdminOrganisationGraphEdge[]
  readonly exceptions: readonly AdminOrganisationGraphException[]
}

/** Which way an edge is walked when collecting a node's cone. */
type Direction = 'downstream' | 'upstream'

/**
 * Every node one step away, in one direction.
 *
 * Built per traversal rather than memoised into an adjacency index: this runs
 * once per request over a graph of tens of nodes, and an index would be a second
 * structure to keep in step with the edges it describes.
 */
const neighbours = (
  edges: readonly AdminOrganisationGraphEdge[],
  direction: Direction,
  id: string
): readonly string[] =>
  direction === 'downstream'
    ? edges.filter((edge) => edge.from === id).map((edge) => edge.to)
    : edges.filter((edge) => edge.to === id).map((edge) => edge.from)

/**
 * Breadth-first closure, expressed as recursion over the frontier.
 *
 * Recursive rather than a loop, per the codebase's functional rules; the depth
 * is the graph's diameter, which is four hops on the deepest shape this endpoint
 * draws (person -> team -> resource, automation -> step -> step).
 */
const expand = (
  edges: readonly AdminOrganisationGraphEdge[],
  direction: Direction,
  frontier: readonly string[],
  seen: ReadonlySet<string>
): ReadonlySet<string> => {
  const fresh = [
    ...new Set(
      frontier.flatMap((id) => neighbours(edges, direction, id)).filter((id) => !seen.has(id))
    ),
  ]
  if (fresh.length === 0) return seen
  return expand(edges, direction, fresh, new Set([...seen, ...fresh]))
}

/** The subject, everything it reaches, and everything that reaches it. */
const cone = (edges: readonly AdminOrganisationGraphEdge[], nodeId: string): ReadonlySet<string> =>
  new Set([
    ...expand(edges, 'downstream', [nodeId], new Set([nodeId])),
    ...expand(edges, 'upstream', [nodeId], new Set([nodeId])),
  ])

/**
 * Narrow the graph to one subject.
 *
 * Node objects are kept as they are: the narrowing is a VIEW, so nothing a node
 * carries — its label, its level, its state, its structural figures — changes
 * because an operator selected something.
 */
export const narrowToNode = (graph: NarrowableGraph, nodeId: string): NarrowableGraph => {
  const kept = cone(graph.edges, nodeId)
  return {
    nodes: graph.nodes.filter((node) => kept.has(node.id)),
    edges: graph.edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to)),
    exceptions: graph.exceptions.filter((exception) => kept.has(exception.resourceNodeId)),
  }
}
