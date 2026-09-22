/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { sidebarEntryMatches } from '@/domain/models/app/pages/sidebar-active-match'
import { buildSystemQueryUrl } from '../runtime/system-query-url'
import { toProjectedEntry, type ProjectedEntry } from './sidebar-entry-projection'
import { currentSidebarAddress, subscribeSidebarNavigation } from './sidebar-navigation-signal'
import type {
  DisclosureSource,
  LeafItem,
  SidebarDisclosureIslandProps,
  SubItem,
} from './sidebar-disclosure-props'

/**
 * Whether this row, or anything in its own nested list, is the live address.
 *
 * The client twin of `marksCurrent` in `sidebar-current-resolver.ts`, and it has
 * to reach the third level for the same reason: a kit category is a FILTER of
 * one page, so a reader who followed one is sitting on a leaf and nothing above
 * it matches exactly. Stopping at the sub-entries would shut the disclosure on
 * precisely the page the reader arrived at through it.
 */
const matchesAtOrBelow = (item: SubItem, path: string): boolean =>
  sidebarEntryMatches(item.href, item.activeMatch, path) ||
  (item.subItems ?? []).some((leaf) => sidebarEntryMatches(leaf.href, leaf.activeMatch, path))

/** The three states only a FETCHED child list can be in. */
export type FetchState = 'idle' | 'loading' | 'ready' | 'error'

/**
 * GET the endpoint and project its rows, or `undefined` when the list could not
 * be loaded at all.
 *
 * A group's fetched entries may fail in silence — nobody asked for them. A
 * disclosure the reader has just clicked open may not: silence after a click
 * reads as a broken control, so a failure has to stay distinguishable from an
 * empty list all the way to the copy.
 *
 * The URL comes from `buildSystemQueryUrl`, the same helper the group's fetch
 * and the KPI and chart system reads use, so `endpoint` + static `query`
 * resolve to one spelling across every consumer of the shared source shape.
 */
async function fetchRows(source: DisclosureSource): Promise<readonly ProjectedEntry[] | undefined> {
  try {
    const response = await fetch(buildSystemQueryUrl(source), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return undefined
    const body = (await response.json()) as Record<string, unknown>
    const rows = body[source.rowsKey]
    if (!Array.isArray(rows)) return undefined
    return rows.flatMap((row: Readonly<Record<string, unknown>>) => {
      const entry = toProjectedEntry(row, source)
      return entry ? [entry] : []
    })
  } catch {
    return undefined
  }
}

/** Everything the disclosure's markup needs, and nothing about how it looks. */
export interface DisclosureController {
  readonly expanded: boolean
  readonly status: FetchState
  readonly entries: readonly ProjectedEntry[]
  readonly onToggle: () => void
  readonly isChildCurrent: (item: LeafItem) => boolean
  readonly isEntryCurrent: (entry: ProjectedEntry) => boolean
}

/**
 * Open/shut state, the one-shot fetch, and the current-child verdict.
 *
 * Split out of the island component only to keep it under its per-function line
 * cap; it has no other caller and is not a general-purpose hook.
 */
export function useSidebarDisclosure(props: SidebarDisclosureIslandProps): DisclosureController {
  const { href, activeMatch, subItems, source } = props
  const [expanded, setExpanded] = useState(props.expanded)
  // The live ADDRESS after a same-document navigation — path AND query, since a
  // row declaring `?category=…` is told from its siblings by nothing else.
  // `undefined` until one happens, which is what makes the server's verdict the
  // answer on first paint.
  const [path, setPath] = useState<string | undefined>(undefined)
  const [entries, setEntries] = useState<readonly ProjectedEntry[]>([])
  const [status, setStatus] = useState<FetchState>('idle')

  // The section's PREVIOUS currentness. The auto-open fires on the transition
  // INTO the section and never on a move within it, so a reader who shut the
  // list deliberately is not overruled the next time they open a sibling
  // object — which is the one thing that would make the affordance hostile.
  const wasCurrent = useRef(props.sectionCurrent)

  // A TOGGLE entry declares no destination, so it can never match the address
  // itself and its sub-entries are the whole answer. The client twin of the gate
  // `markItems` puts on the server's match, and there for the same reason: the
  // SECTION still has to be recognised, or a same-document navigation into one
  // of its children would shut the list the reader just arrived through.
  const sectionCurrent =
    path === undefined
      ? props.sectionCurrent
      : (href !== undefined && sidebarEntryMatches(href, activeMatch, path)) ||
        (subItems ?? []).some((item) => matchesAtOrBelow(item, path))

  useEffect(() => {
    if (props.track !== true) return
    return subscribeSidebarNavigation(() => setPath(currentSidebarAddress()))
  }, [props.track])

  useEffect(() => {
    if (sectionCurrent && !wasCurrent.current) setExpanded(true)
    // eslint-disable-next-line functional/immutable-data -- the previous-value ref IS the edge detector this effect exists to hold
    wasCurrent.current = sectionCurrent
  }, [sectionCurrent])

  // Whether the ONE request this disclosure ever makes has been started.
  //
  // A ref and not the `status` state, which was the first shape and was wrong:
  // `status` in the dependency array makes `setStatus('loading')` re-run the
  // effect, and the re-run's cleanup cancels the fetch that had just been
  // started — so the list stayed on "Loading…" forever. The ref is read and
  // written without re-rendering, which is exactly what a once-only guard needs.
  const requested = useRef(false)

  useEffect(() => {
    if (!expanded || source === undefined || requested.current) return
    // eslint-disable-next-line functional/immutable-data -- the request-once guard IS the state this ref exists to hold
    requested.current = true
    setStatus('loading')
    // Deliberately no cleanup cancelling this: re-opening a disclosure must
    // paint from what was already loaded rather than ask the server again, and
    // a `setState` after unmount is a no-op.
    void fetchRows(source).then((result) => {
      setStatus(result === undefined ? 'error' : 'ready')
      setEntries(result ?? [])
    })
  }, [expanded, source])

  const onToggle = useCallback(() => setExpanded((open) => !open), [])
  const isChildCurrent = useCallback(
    (item: LeafItem): boolean =>
      path === undefined
        ? item.current === true
        : sidebarEntryMatches(item.href, item.activeMatch, path),
    [path]
  )

  /**
   * Whether a FETCHED row is the current page.
   *
   * Separate from {@link isChildCurrent} because the fall-back differs, and the
   * difference is the whole reason this exists. An AUTHORED sub-entry was in the
   * document at render time, so the server already answered for it and
   * `item.current` is that answer. A fetched row was not: it is invented in the
   * browser after the reader opened the disclosure, so there is no server
   * verdict to fall back to and the live address is the only source.
   *
   * Reading `window.location` unconditionally is safe here in a way it is not in
   * the SSR half: this component only ever renders in a browser.
   *
   * No `activeMatch` — a fetched row addresses one object, so `exact` (the
   * default) is right and `prefix` would mark a sibling.
   */
  const isEntryCurrent = useCallback(
    (entry: ProjectedEntry): boolean =>
      sidebarEntryMatches(entry.href, undefined, path ?? currentSidebarAddress()),
    [path]
  )

  return { expanded, status, entries, onToggle, isChildCurrent, isEntryCurrent }
}
