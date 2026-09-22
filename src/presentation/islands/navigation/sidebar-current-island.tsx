/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { sidebarEntryMatches } from '@/domain/models/app/pages/sidebar-active-match'
import { computeSidebarEntryClasses } from '@/presentation/design/sidebar-default-classes'
import { currentSidebarAddress, subscribeSidebarNavigation } from './sidebar-navigation-signal'

/**
 * Re-derive `aria-current` on a sidebar's server-rendered entries after a
 * SAME-DOCUMENT navigation.
 *
 * The mark is resolved on the server, which is correct and sufficient while
 * every navigation is a page load. An app that swaps its content region in
 * place leaves the sidebar mounted and the server's mark frozen on the page the
 * reader has already left — so the one element that answers "where am I"
 * becomes the one element that is wrong, and stays wrong for the session. A
 * stale colour merely looks wrong; `aria-current` is what a screen reader is
 * told, so it MISINFORMS.
 *
 * ─── WHY THIS ISLAND MUTATES DOM INSTEAD OF RENDERING ──────────────────────
 *
 * The entries belong to the server: each `<a>` carries its icon as inline SVG
 * and may host a badge island of its own. Re-rendering them here would mean
 * shipping the icon set to the browser and tearing down a nested island on every
 * navigation, to change one attribute and one class. So this island renders
 * nothing and edits the two things that actually differ.
 *
 * It deliberately does NOT touch a link inside a `sidebar-disclosure` host:
 * those sub-entries are React-owned, they re-derive the same mark from the same
 * predicate, and a DOM write there would be clobbered by the next render.
 * Ownership is an ANCESTOR fact, so it is tested with `closest()` rather than
 * with a `:not()` selector, which cannot express it.
 */
export default function SidebarCurrentIsland() {
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = anchor.current?.closest('[data-sidebar-root]')
    if (root === null || root === undefined) return

    const apply = (): void => {
      // The full address, query included — an entry declaring `?category=…` is
      // current only when the reader carries it, and the server resolved the
      // server-rendered mark that same way.
      const path = currentSidebarAddress()
      root.querySelectorAll<HTMLAnchorElement>('a[data-sidebar-entry]').forEach((entry) => {
        if (entry.closest('[data-island="sidebar-disclosure"]') !== null) return
        const isCurrent = sidebarEntryMatches(
          entry.getAttribute('href') ?? '',
          entry.getAttribute('data-active-match'),
          path
        )
        if (isCurrent) entry.setAttribute('aria-current', 'page')
        else entry.removeAttribute('aria-current')
        entry.setAttribute('class', computeSidebarEntryClasses(isCurrent))
      })
    }

    // Run once on mount as well as on every signal. The server's mark is already
    // right at that instant, so this is normally a no-op — but it also closes
    // the window in which a navigation is announced BEFORE the island has
    // finished mounting, where listening alone would miss the only event ever
    // sent and leave the mark stale for the rest of the session.
    apply()
    return subscribeSidebarNavigation(apply)
  }, [])

  return (
    <span
      ref={anchor}
      hidden
    />
  )
}
