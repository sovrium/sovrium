/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Selecting one node, and computing what it reaches.
 *
 * ─── THIS IS THE WHOLE REASON `graph` IS AN ISLAND ─────────────────────────
 *
 * Everything else about the component is server-rendered: the twin, the notice,
 * the empty state, and the projection the drawing is made from. What cannot be
 * is this — a node is focused, `Enter` or `Space` selects it, the reach set is
 * walked, and everything outside it dims. All of that changes after the
 * document has been delivered, which is precisely the line `matrix` next door
 * does not cross.
 *
 * ─── THE HIGHLIGHT IS INTERNAL STATE AND IS NEVER PUBLISHED ────────────────
 *
 * The reach set is computed here and crosses nothing. The only thing that
 * reaches the shared-filter bus is the selected node's **id**, under
 * `publishes.param`. The schema says why: a subscriber receiving "the 41 nodes
 * downstream of this one" would be receiving a rendering DECISION, and could
 * not act on it anyway. It is also why `reach` is configured on `selection`
 * rather than being a property of the publisher.
 *
 * And the bus limitation is real and recorded rather than papered over:
 * `GET /api/admin/organisation/graph` accepts no query parameter in v1, so
 * against the one shipped consumer this is a well-formed publisher whose
 * channel no subscriber can yet act on. Making it act is an O1 widening of the
 * endpoint, not a change here.
 *
 * ─── THE WALK IS TRANSITIVE, AND IT TERMINATES ON A CYCLE ──────────────────
 *
 * `reach` is the whole downstream (or upstream, or connected) component, not
 * the direct neighbours — "what can this person reach" is a question about
 * paths. A visited set carries the BFS, so a configuration with a cycle in it
 * (a role that grants an agent that triggers the role) is walked once rather
 * than forever.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSharedFilterPublisher } from '@/presentation/islands/hooks/use-shared-filter-publisher'
import type {
  GraphEdgeView,
  GraphPublishesConfig,
  GraphReach,
} from '@/presentation/islands/graph/graph-island-types'

/** What the drawing needs in order to mark one node or one edge. */
export interface GraphSelectionState {
  readonly selectedId: string | undefined
  /** Nodes inside the reach set, EXCLUDING the selected node itself. */
  readonly reachedNodes: ReadonlySet<string>
  /** Edges traversed while walking the reach set. */
  readonly reachedEdges: ReadonlySet<string>
  /** Whether anything is selected at all — nothing is marked when nothing is. */
  readonly active: boolean
  readonly select: (id: string) => void
}

/** The reach set and the edges walked to reach it, from one origin. */
interface Walked {
  readonly nodes: ReadonlySet<string>
  readonly edges: ReadonlySet<string>
}

const EMPTY: Walked = { nodes: new Set(), edges: new Set() }

/**
 * Whether this edge may be walked FROM `node`, and where it lands.
 *
 * The three directions are the closed {@link GraphReach} vocabulary, and they
 * are platform words rather than the endpoint's — every directed graph has a
 * direction, where the edges being traversed carry the bound graph's own
 * meanings. `downstream` walks with the arrows, `upstream` against them, and
 * `both` takes either, which is what makes it the whole connected component.
 */
const step = (edge: GraphEdgeView, node: string, reach: GraphReach): string | undefined => {
  const forward = reach !== 'upstream' && edge.from === node
  const backward = reach !== 'downstream' && edge.to === node
  if (forward) return edge.to
  if (backward) return edge.from
  return undefined
}

/**
 * Walk the reach set from one origin, breadth-first.
 *
 * Written as a fold over immutable sets rather than as a mutating BFS —
 * `functional/immutable-data` forbids `Set.add`, and the rule is right here for
 * an ordinary reason: each round's frontier is derived from the last, so there
 * is a value to return at every step and nothing needs to be accumulated in
 * place. `new Set([...a, ...b])` constructs; it does not mutate.
 *
 * The origin is NOT in the returned node set: it carries
 * `data-graph-selected="true"` and is neither reached nor dimmed, so a census
 * of the reach set counts what the selection found rather than the selection
 * plus itself.
 *
 * The `seen` set is what makes this terminate on a cyclic configuration — a
 * role granting an agent that triggers the role back — by keeping each node out
 * of every frontier after its first.
 */
const walk = (origin: string, edges: readonly GraphEdgeView[], reach: GraphReach): Walked => {
  const advance = (
    seen: ReadonlySet<string>,
    used: ReadonlySet<string>,
    frontier: readonly string[]
  ): Walked => {
    if (frontier.length === 0) {
      return { nodes: new Set([...seen].filter((id) => id !== origin)), edges: used }
    }
    const steps = frontier.flatMap((node) =>
      edges.flatMap((edge) => {
        const landed = step(edge, node, reach)
        return landed === undefined ? [] : [{ edge: edge.id, landed }]
      })
    )
    const next = [...new Set(steps.map((one) => one.landed).filter((id) => !seen.has(id)))]
    return advance(
      new Set([...seen, ...next]),
      new Set([...used, ...steps.map((one) => one.edge)]),
      next
    )
  }
  return advance(new Set([origin]), new Set(), [origin])
}

/**
 * Selection state for one drawing.
 *
 * Returns an inert state when `selection` was not declared: `select` is a
 * no-op, nothing is ever active, and the drawing marks nothing — which is what
 * makes "absent means not selectable" true without the drawing having to ask.
 *
 * Selecting the already-selected node CLEARS the selection. A drawing where
 * every node outside one reach set is permanently dimmed, with no way back to
 * the whole picture except reloading, is a worse drawing than one without
 * selection at all.
 */
export const useGraphSelection = (
  edges: readonly GraphEdgeView[],
  selectable: boolean,
  reach: GraphReach,
  publishes: GraphPublishesConfig | undefined
): GraphSelectionState => {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const publish = useSharedFilterPublisher(publishes)

  const select = useCallback(
    (id: string): void => {
      if (!selectable) return
      setSelectedId((current) => {
        const next = current === id ? undefined : id
        publish(next ?? '')
        return next
      })
    },
    [selectable, publish]
  )

  const walked = useMemo(
    () => (selectedId === undefined ? EMPTY : walk(selectedId, edges, reach)),
    [selectedId, edges, reach]
  )

  return {
    selectedId,
    reachedNodes: walked.nodes,
    reachedEdges: walked.edges,
    active: selectedId !== undefined,
    select,
  }
}

/**
 * The three marking attributes for one node or edge, as the DOM contract spells
 * them.
 *
 * Nothing is marked while nothing is selected — a drawing at rest carries no
 * selection attributes at all, so their presence is itself the signal that a
 * selection is in effect. The selected node is `selected` and NEITHER reached
 * nor dimmed: it is the origin of the question, not an answer to it.
 */
export const selectionMarks = (
  id: string,
  state: GraphSelectionState,
  reachedIds: ReadonlySet<string>
): Readonly<Record<string, string>> => {
  if (!state.active) return {}
  if (id === state.selectedId) return { 'data-graph-selected': 'true' }
  return reachedIds.has(id) ? { 'data-graph-reached': 'true' } : { 'data-graph-dimmed': 'true' }
}
