/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a drawn `graph` node carries no matter which layout placed it.
 *
 * Both drawings — the layered columns and the lanes — answer three identical
 * questions per node: is it focusable and how does it select, what colour does
 * its weight give it, and does it publish a state. Those answers moved here
 * when the second layout arrived, rather than being copied into it, because a
 * node that selects differently depending on how it was placed would be a bug
 * nobody would think to look for.
 *
 * A plain module and not a component file, deliberately: mixing a hook export
 * with a component export defeats fast refresh, which is the same reason
 * `graph-island-host.tsx` sits apart from `island-graph-component.tsx`.
 */

import { useCallback, useMemo } from 'react'
import type { KeyboardEvent } from 'react'

/** How far outside the reach set is pushed. Legible, but plainly secondary. */
export const DIMMED_OPACITY = 0.2

/**
 * The node's look on shadcn/ui's anatomy: a small card (the card ground, ringed
 * in the hairline `ring-foreground/10` draws), ringed in the ring colour when
 * selected. A disabled node is drawn at half opacity rather than in a second
 * ink, so its name keeps its contrast relative to its own box.
 */
const NODE_CLASS = {
  plain: 'text-card-foreground',
  selectable: 'text-card-foreground cursor-pointer',
}

/** The class of a node's `<g>`. */
export const nodeClassOf = (selectable: boolean): string =>
  selectable ? NODE_CLASS.selectable : NODE_CLASS.plain

/** A node's opacity: dimmed by a selection elsewhere, else halved when disabled. */
export const nodeOpacityOf = (muted: boolean, dimmed: boolean): number => {
  if (dimmed) return DIMMED_OPACITY
  return muted ? 0.5 : 1
}

/** The node box: the card ground, its edge the hairline or, selected, the ring. */
export const nodeBoxClassOf = (selected: boolean): string =>
  selected ? 'fill-card stroke-ring' : 'fill-card stroke-foreground/10'

/** A column heading or a band caption: muted, small, medium weight. */
export const GRAPH_LABEL_CLASS = 'fill-muted-foreground text-xs font-medium'

/** The edges' stroke: the border colour. */
export const GRAPH_EDGE_CLASS = 'stroke-border'

/** An edge's width: 1.5 at rest, 2 when a selection reaches it. */
export const edgeWidthOf = (reached: boolean): number => (reached ? 2 : 1.5)

export const stateMark = (state: string | undefined): Readonly<Record<string, string>> =>
  state === undefined ? {} : { 'data-graph-node-state': state }

/** A flagged node publishes the mark, and carries the flag's word as its `title`. */
export const flagMark = (flag: string | undefined): Readonly<Record<string, string>> =>
  flag === undefined ? {} : { 'data-graph-node-flag': 'true', title: flag }

/** A node's pointer `<title>`: its name, then its flag's word and its `detail`. */
export const nodeTitleOf = (node: {
  readonly label: string
  readonly flag?: string
  readonly detail?: string
}): string => [node.label, node.flag, node.detail].filter((part) => part !== undefined).join(' — ')

/**
 * The interaction attributes for one node, memoised as ONE bag.
 *
 * Three things at once, and each is load-bearing. `react-perf` forbids a
 * closure allocated in JSX, so the two handlers are `useCallback`s; the whole
 * bag is a `useMemo` so the spread is one stable object rather than a fresh
 * literal per render; and a NON-selectable drawing gets an EMPTY bag, so no
 * node takes a `tabindex` and none is focusable — which is how "`selection`
 * absent means not selectable" holds without either drawing testing for it.
 *
 * `Space` is handled alongside `Enter` and both `preventDefault()`, because a
 * `Space` that scrolls the page while selecting a node in a drawing 1,700px
 * tall moves the thing the reader was looking at out of view.
 */
export const useNodeInteraction = (
  id: string,
  selectable: boolean,
  onSelect: (id: string) => void
): Readonly<Record<string, unknown>> => {
  const onClick = useCallback((): void => onSelect(id), [id, onSelect])
  const onKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>): void => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onSelect(id)
    },
    [id, onSelect]
  )
  return useMemo(
    () => (selectable ? { tabIndex: 0, onClick, onKeyDown } : {}),
    [selectable, onClick, onKeyDown]
  )
}
