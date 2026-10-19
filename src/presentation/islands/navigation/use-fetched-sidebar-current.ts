/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type RefObject } from 'react'
import {
  normalizeSidebarPath,
  sidebarEntryMatches,
} from '@/domain/models/app/pages/sidebar-active-match'
import { setSidebarEntryMark } from './sidebar-entry-mark'
import { currentSidebarAddress, subscribeSidebarNavigation } from './sidebar-navigation-signal'
import type { ProjectedEntry } from './sidebar-entry-projection'

/**
 * Which FETCHED entry of a group is the current page, if any.
 *
 * A fetched row is matched against the address exactly like an authored entry
 * — the one rule, `sidebarEntryMatches`, with the source's `activeMatch` — and
 * when several entries match, the one with the LONGEST href is current,
 * authored or fetched. The server marked the authored entries before any row
 * existed, so an authored section entry (`/engineer`, by prefix) may hold the
 * mark while the reader is on a fetched project below it. When a fetched row
 * wins, that shorter authored mark is taken off here, so one navigation answers
 * "where am I" once.
 *
 * Authored entries are read off the DOM — their resolved `href` and their
 * `data-active-match` — never off their current mark, which this hook writes.
 * Entries inside an authored disclosure are React-owned and left alone, as the
 * client tracker leaves them.
 */

/** A path's length once normalised: how specific an entry's destination is. */
const specificity = (href: string): number => normalizeSidebarPath(href).length

/** The server-rendered entries of the sidebar around `host`, outside it. */
function authoredEntries(host: HTMLElement): readonly HTMLAnchorElement[] {
  const root = host.closest('[data-sidebar-root]')
  if (root === null) return []
  return [...root.querySelectorAll<HTMLAnchorElement>('a[data-sidebar-entry]')].filter(
    (anchor) =>
      !host.contains(anchor) && anchor.closest('[data-island="sidebar-disclosure"]') === null
  )
}

/** The fetched entry matching `address` with the longest href, if any. */
function longestMatch(
  entries: readonly ProjectedEntry[],
  activeMatch: string | undefined,
  address: string
): ProjectedEntry | undefined {
  return entries
    .filter((entry) => sidebarEntryMatches(entry.href, activeMatch, address))
    .reduce<ProjectedEntry | undefined>(
      (best, entry) =>
        best === undefined || specificity(entry.href) > specificity(best.href) ? entry : best,
      undefined
    )
}

export function useFetchedSidebarCurrent(
  entries: readonly ProjectedEntry[],
  activeMatch: string | undefined,
  host: RefObject<HTMLElement | null>
): string | undefined {
  const [address, setAddress] = useState<string | undefined>(undefined)
  const [current, setCurrent] = useState<string | undefined>(undefined)

  useEffect(() => subscribeSidebarNavigation(() => setAddress(currentSidebarAddress())), [])

  useEffect(() => {
    const element = host.current
    if (element === null) return
    const live = address ?? currentSidebarAddress()
    const mine = longestMatch(entries, activeMatch, live)
    const authored = authoredEntries(element)
    const authoredBest = Math.max(
      0,
      ...authored
        .filter((anchor) =>
          sidebarEntryMatches(
            anchor.getAttribute('href') ?? '',
            anchor.getAttribute('data-active-match'),
            live
          )
        )
        .map((anchor) => specificity(anchor.getAttribute('href') ?? ''))
    )
    if (mine === undefined || specificity(mine.href) <= authoredBest) {
      setCurrent(undefined)
      return
    }
    authored
      .filter((anchor) => anchor.getAttribute('aria-current') === 'page')
      .forEach((anchor) => setSidebarEntryMark(anchor, false))
    setCurrent(mine.href)
  }, [entries, activeMatch, address, host])

  return current
}
