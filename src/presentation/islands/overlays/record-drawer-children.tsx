/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record drawer's composed-content slot ([internal ref] CAP-5).
 *
 * The author's `children` reach the browser as markup the SSR host already
 * rendered (`record-bound-drawer.tsx` → `childrenHtml`), because the surface is
 * built before anyone knows which record it will open for. Three things
 * therefore happen HERE rather than on the server, and only here:
 *
 *  0. A container declaring `repeat` is expanded into one copy of its children
 *     per element of the array the record carries (CAP-6). It runs FIRST, and
 *     the pass below then steps AROUND the copies: inside one, `$record.` names
 *     a key on the element, and resolving it a second time against the drawer's
 *     record is precisely the leak `-REPEAT-002` discriminates. The expansion
 *     itself lives in `./record-drawer-repeat.ts`, which explains why the copies
 *     are cloned rather than re-serialised.
 *
 *  1. `$record.<field>` inside the slot is resolved once the record lands. The
 *     token reaches the browser LITERALLY — there is no record at render time —
 *     so a slot that stopped at injection would be decoration. The resolution
 *     walks the slot's own text nodes and writes the resolved text back, which
 *     is what `page-record-system-island.tsx` does for a page bound to a system
 *     record, through the same one substituter.
 *
 *     Writing a NODE VALUE rather than re-parsing a string is also what keeps
 *     record data out of the markup path: the value lands as text by
 *     construction, so there is no HTML for it to become.
 *
 *  2. Markers nested in the slot are mounted. The markup is injected after the
 *     page's first-load pass, so nothing would ever mount them — the same gap
 *     the tabs island closes for its panels, closed the same way and for the
 *     same reason.
 */

import { useCallback, useEffect, useRef, type ReactElement } from 'react'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import {
  collectTextNodes,
  expandSlotRepeats,
  isRepeatHost,
  type RepeatStates,
} from './record-drawer-repeat'

type RawRecord = Record<string, unknown>

/**
 * Resolve the slot's `$record.*` tokens against the loaded record.
 *
 * `isRepeatHost` is the scope boundary: the walk stops at a repeating container,
 * because everything under one was already resolved against ITS OWN element and
 * a second pass here would re-resolve the leftovers against the drawer. An
 * object-valued key survives expansion as its own token on purpose, so that
 * second pass would quietly replace a diagnosable `$record.payload` with the
 * empty string — the one outcome CAP-6 chose against.
 *
 * `pristine` holds the ORIGINAL text of every node that carried a token, keyed
 * by the node itself. Without it a second pass would find nothing to resolve —
 * the first pass consumes the tokens it replaces — so a drawer re-opened on
 * another record would keep showing the first one's values. A WeakMap because
 * the keys are DOM nodes: a detached one has to be collectable.
 */
function resolveSlotTokens(
  root: HTMLElement,
  record: RawRecord,
  pristine: WeakMap<Text, string>
): void {
  collectTextNodes(root, isRepeatHost).forEach((text) => {
    const source = pristine.get(text) ?? text.nodeValue ?? ''
    if (!source.includes('$record.')) return
    pristine.set(text, source)
    const next = substituteRecordVars(source, record)
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- writing the resolved text into the DOM is the contract here, exactly as in `distributeRecord`
    if (next !== text.nodeValue) text.nodeValue = next
  })
}

/**
 * Put the SSR markup in place, ONCE per distinct slot.
 *
 * Imperative rather than `dangerouslySetInnerHTML`, and that is the whole point.
 * React 19 re-applies that prop on every update WITHOUT comparing it to the
 * previous value, so each re-render of the drawer — a keystroke in an editable
 * field is enough — would re-inject the pristine markup over the resolved text
 * and tear out any marker mounted inside it. Owning the children here means
 * React never touches them, and the slot's content survives the drawer's own
 * render loop.
 */
function injectSlotMarkup(root: HTMLElement, html: string): void {
  // eslint-disable-next-line functional/immutable-data, no-param-reassign -- placing the host-rendered markup IS this function; see above for why React may not own it
  root.innerHTML = html
}

/**
 * Mount the markers the injected markup brought with it.
 *
 * Dynamically imported for the reason the tabs island gives: a static edge from
 * an island to `island-client` closes an island-client ↔ registry cycle. The
 * preload runs first so a priority marker resolves before the mount pass, and
 * `mountIslandsWithin` skips anything already mounted, so re-running is free.
 */
function mountSlotIslands(root: HTMLElement, done: () => void): void {
  void import('@/presentation/islands/island-client').then(
    async ({ mountIslandsWithin, preloadIslandsWithin }) => {
      await preloadIslandsWithin(root)
      mountIslandsWithin(root)
      done()
    }
  )
}

/**
 * The slot itself. Rendered only where the author declared children, so a
 * drawer without them emits nothing at all — no container, no separator, no
 * spacer — and reads exactly as it did before this slot existed.
 */
export function RecordDrawerChildren({
  html,
  record,
}: {
  readonly html: string
  readonly record: RawRecord
}): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pristineRef = useRef<WeakMap<Text, string>>(new WeakMap())
  const repeatsRef = useRef<RepeatStates>(new WeakMap())

  const resolve = useCallback(() => {
    const root = containerRef.current
    if (!root) return
    expandSlotRepeats(root, record, repeatsRef.current)
    resolveSlotTokens(root, record, pristineRef.current)
  }, [record])

  // Read through a ref so the injection below stays keyed to the MARKUP: it must
  // not re-run — and re-mount everything under it — every time the record moves.
  const resolveRef = useRef(resolve)
  // eslint-disable-next-line functional/immutable-data -- a ref's `.current` is React's own mutable cell, which is what it is for
  resolveRef.current = resolve

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    injectSlotMarkup(root, html)
    resolveRef.current()
    mountSlotIslands(root, () => resolveRef.current())
  }, [html])

  // The drawer opens BEFORE its record arrives, so the first pass above always
  // runs against an empty one; this is the pass that puts the values in.
  useEffect(resolve, [resolve])

  return (
    <div
      ref={containerRef}
      data-drawer-children=""
    />
  )
}
