/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/** An entry needing the bundle: one that EXPANDS, or one whose badge is fetched. */
function itemNeedsIsland(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false
  const { badge, children, source } = item as {
    badge?: unknown
    children?: unknown
    source?: unknown
  }
  // A disclosure's toggle is inert without JavaScript: the server renders the
  // button and the open-on-arrival state, but nothing can OPEN it afterwards.
  //
  // TOP-LEVEL items only, and that stays correct now that a sub-entry may hold
  // a list of its own. A third level is ALWAYS OPEN and carries no toggle, so it
  // needs nothing hydrated for its own sake — and it can only exist inside a
  // sub-entry, which can only exist inside a top-level `children`, so this
  // already returned `true` before reaching it. There is no arrangement in which
  // a nested list mounts a control whose script was never injected.
  if (children !== undefined || source !== undefined) return true
  // A LITERAL badge is server-rendered; only the endpoint-backed form needs
  // the bundle, so a sidebar of static markers stays fully SSR.
  return typeof badge === 'object' && badge !== null
}

/**
 * True when a `sidebar` mounts an island — a group whose entries are FETCHED
 * (`sidebar-groups`), an entry whose badge is a fetched count (`sidebar-badge`),
 * an entry that EXPANDS (`sidebar-disclosure`), or a sidebar re-deriving its
 * current-entry mark after a same-document navigation (`sidebar-current`).
 *
 * `sidebar` is deliberately NOT in `ISLAND_COMPONENT_TYPES`: an authored-only
 * grouped sidebar with no disclosures is entirely server-rendered, and listing
 * the type would build the island bundle — and inject its hydration `<script>` —
 * for every sidebar in every app, most of which need none of this.
 *
 * Shared by the TWO call-sites that must agree, exactly as `isListIslandMode`
 * is: the page renderer's `selfNeedsIslands` (BUILD the bundle) and
 * `PageIslandDetection`'s `itemSelfNeedsIslands` (INJECT the script). If they
 * diverge, the bundle is built with no script tag (the toggle renders and does
 * nothing when clicked) or the script tag 404s.
 */
export function isSourcedSidebar(component: Component): boolean {
  if (component.type !== 'sidebar') return false
  const { groups, trackNavigation } = component as {
    groups?: unknown
    trackNavigation?: unknown
  }
  if (!Array.isArray(groups)) return false
  if (trackNavigation === true) return true
  return groups.some((group: unknown) => {
    if (typeof group !== 'object' || group === null) return false
    const { source, items } = group as { source?: unknown; items?: unknown }
    if (source !== undefined) return true
    return Array.isArray(items) && items.some(itemNeedsIsland)
  })
}
