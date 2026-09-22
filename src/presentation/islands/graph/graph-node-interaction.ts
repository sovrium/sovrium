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
 * The four node class strings, spelled out WHOLE.
 *
 * Deliberately a lookup rather than a composed template literal. The first
 * version of this was
 * `` `${muted ? a : b}${selectable ? ' cursor-pointer' : ''}` ``, and the
 * Prettier Tailwind plugin rewrote the interpolation and ate the leading space
 * — emitting `text-foregroundcursor-pointer`, one class that exists nowhere,
 * silently losing BOTH the colour and the cursor. Nothing catches that: it
 * typechecks, it lints, and Tailwind simply never emits a rule for it.
 *
 * Whole literals are also what the CSS candidate corpus can actually see, since
 * it harvests identifiers from source text rather than evaluating it.
 */
const NODE_CLASS = {
  plain: 'text-foreground',
  plainSelectable: 'text-foreground cursor-pointer',
  muted: 'text-foreground-subtle',
  mutedSelectable: 'text-foreground-subtle cursor-pointer',
} as const

export const nodeClassOf = (muted: boolean, selectable: boolean): string => {
  if (muted) return selectable ? NODE_CLASS.mutedSelectable : NODE_CLASS.muted
  return selectable ? NODE_CLASS.plainSelectable : NODE_CLASS.plain
}

/**
 * The node's own `data-graph-node-state`, or NOTHING when it carries none.
 *
 * The absence is the whole contract and is why this is a function rather than
 * an inline attribute. `GET /api/admin/organisation/graph` omits `state`
 * entirely when the pause ledger could not be read — precisely so that "this
 * automation is running" and "this read could not tell" do not share a spelling
 * — and a renderer defaulting the attribute to `active` would re-collapse the
 * distinction the producer went out of its way to keep. An operator would then
 * read a healthy lane over an outage.
 */
export const stateMark = (state: string | undefined): Readonly<Record<string, string>> =>
  state === undefined ? {} : { 'data-graph-node-state': state }

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
