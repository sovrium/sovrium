/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two facts this body carries REDUNDANTLY, and the one constraint that makes
 * both of them right.
 *
 * The Organisation page's lenses are declarative bindings: a `table` over
 * `rowsKey: 'edges'` renders one edge per row, and a `key-value` binding
 * resolves `$record.<key>` as a SINGLE flat segment. Such a consumer can neither
 * JOIN two arrays of the body nor COMPUTE over one. So anything it needs that is
 * a function of the graph has to be denormalised onto the row before it ships:
 *
 *   - {@link withEndpointLabels} copies each endpoint's `label` onto the edge,
 *     because a row binding cannot look `edges[].from` up in `nodes`. Most ids
 *     read acceptably in front of an operator — `page:home`, `role:admin`,
 *     `table:waitlist` — but a `person:` id is the account's opaque key, and the
 *     shipped Reach lens prints `person:mg7czPiGzxoGDBGMBqhp9ovF9R0sB8hx` where
 *     a human expects a name. Not a leak, an id is not an address; the one cell
 *     on that page an operator cannot act on.
 *   - {@link withPrincipalFigures} folds the four Reach figures onto each
 *     principal, because `$record.holds` resolves one segment and a consumer
 *     cannot walk `edges` to derive them.
 *
 * The alternative considered and refused for the labels was a lookup table in
 * the config layer: it would rot on the first rename and would have to be
 * written once per lens.
 *
 * ─── WHY THE FIGURES ARE NOT RECOMPUTED AFTER `?node=` ───────────────────────
 *
 * They are folded over the WHOLE graph, before any narrowing, and the narrowing
 * then filters nodes without touching them. This is the rule `findings` already
 * follows and for the identical reason: a figure that shrank when an operator
 * clicked a table would report that the principal's reach went away. `reaches`
 * answers "what can this person get to in this application", which is a fact
 * about the instance rather than about the current selection.
 *
 * The two readings coincide exactly where the product uses them — narrowing to a
 * PRINCIPAL keeps that principal's whole downstream cone, so the figures folded
 * over the whole graph are the figures its own surviving edges produce — and
 * diverge only when an operator narrows to a resource and reads a bystander's
 * figures, where the alternative is the one that lies.
 *
 * ─── S4 ──────────────────────────────────────────────────────────────────────
 *
 * A copied label is exactly as safe as the label it copies: the value IS the
 * node's own `label`, so there is no second fallback path here for an account
 * address to slip through. An unnamed account carries the node's
 * `UNNAMED_PRINCIPAL_LABEL` on both sides, never its email.
 *
 * @see src/application/use-cases/admin/organisation-graph.ts (the assembly)
 * @see src/domain/models/api/admin/organisation/graph.ts (the wire contract)
 */

import type {
  AdminOrganisationGraphEdge,
  AdminOrganisationGraphNode,
} from '@/domain/models/api/admin/organisation/graph'

/** The node kinds that ARE principals, and therefore the kinds that carry figures. */
const PRINCIPAL_KINDS: ReadonlySet<string> = new Set(['person', 'agent'])

/**
 * The `ops` letters that mean a grant can CHANGE the resource.
 *
 * `R` is not one, and neither is `AI`: an AI-access grant is its own rung, and
 * folding it in would report a principal as a writer on the strength of a tool
 * permission.
 */
const WRITE_OPS = /[CUDW]/

/** Every node's label, by id — the join a declarative row binding cannot make. */
const labelsById = (nodes: readonly AdminOrganisationGraphNode[]): ReadonlyMap<string, string> =>
  new Map(nodes.map((node) => [node.id, node.label]))

/**
 * Copy each endpoint's display name onto the edge.
 *
 * A key is omitted rather than filled with the id when an endpoint does not
 * resolve. That case is a producer bug the referential invariant already
 * forbids, and printing the id under a key whose contract says "a NAME" would
 * hide it behind the very cell this exists to fix.
 */
export const withEndpointLabels = (
  edges: readonly AdminOrganisationGraphEdge[],
  nodes: readonly AdminOrganisationGraphNode[]
): readonly AdminOrganisationGraphEdge[] => {
  const labels = labelsById(nodes)
  return edges.map((edge) => {
    const fromLabel = labels.get(edge.from)
    const toLabel = labels.get(edge.to)
    return {
      ...edge,
      ...(fromLabel === undefined ? {} : { fromLabel }),
      ...(toLabel === undefined ? {} : { toLabel }),
    }
  })
}

/** The four figures the Reach lens's "Structural position" block reads. */
interface PrincipalFigures {
  readonly holds: number
  readonly reaches: number
  readonly writes: number
  readonly duplicateRoutes: number
}

/**
 * Fold one principal's structural position out of the edges.
 *
 * `holds` counts the distinct grant sources its `member` edges leave for. The
 * open rung is not among them by construction: nobody stands in `*`, which is
 * exactly what makes it open, so no `member` edge ever points at it.
 *
 * `reaches` counts each resource ONCE however many routes lead to it, which is
 * what makes it comparable with `duplicateRoutes` rather than a restatement of
 * it.
 */
const figuresFor = (
  principalId: string,
  edges: readonly AdminOrganisationGraphEdge[]
): PrincipalFigures => {
  const held = new Set(
    edges.filter((edge) => edge.kind === 'member' && edge.from === principalId).map((e) => e.to)
  )
  const grants = edges.filter((edge) => edge.kind === 'grant' && held.has(edge.from))
  const reached = [...new Set(grants.map((grant) => grant.to))]
  const sourceCount = (resource: string): number =>
    new Set(grants.filter((grant) => grant.to === resource).map((grant) => grant.from)).size
  return {
    holds: held.size,
    reaches: reached.length,
    writes: new Set(grants.filter((g) => WRITE_OPS.test(g.ops ?? '')).map((g) => g.to)).size,
    duplicateRoutes: reached.filter((resource) => sourceCount(resource) >= 2).length,
  }
}

/**
 * Fold the four figures onto every principal node, and onto no other kind.
 *
 * ABSENT rather than zero elsewhere, which is two-sided on purpose: a `table`
 * carrying `holds: 0` would assert a fact about a thing that has no such fact,
 * and a principal genuinely holding nothing would then be indistinguishable from
 * a resource.
 */
export const withPrincipalFigures = (
  nodes: readonly AdminOrganisationGraphNode[],
  edges: readonly AdminOrganisationGraphEdge[]
): readonly AdminOrganisationGraphNode[] =>
  nodes.map((node) =>
    PRINCIPAL_KINDS.has(node.kind) ? { ...node, ...figuresFor(node.id, edges) } : node
  )
