/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeSidebarEntryClasses,
  computeSidebarSubEntryClasses,
} from '@/presentation/design/sidebar-default-classes'

/**
 * Set or clear the current-page mark on a SERVER-RENDERED sidebar entry, in
 * place.
 *
 * Only what differs between the resting and the current look is swapped: the
 * two attributes, and the classes one look has and the other lacks. Rewriting
 * the whole `class` attribute instead would drop the author's own `parts.link`
 * classes the server folded in, and would draw a nested entry with a top-level
 * entry's geometry. The look is read off the entry's own `data-slot`, which the
 * server wrote for exactly that distinction.
 *
 * One function for the two islands that move the mark — the client tracker and
 * a group's fetched rows — so they cannot drift apart.
 */
export function setSidebarEntryMark(anchor: HTMLAnchorElement, current: boolean): void {
  const classes =
    anchor.getAttribute('data-slot') === 'sidebar-menu-sub-button'
      ? computeSidebarSubEntryClasses
      : computeSidebarEntryClasses
  const wanted = classes(current).split(' ')
  const other = classes(!current).split(' ')
  anchor.classList.remove(...other.filter((name) => !wanted.includes(name)))
  anchor.classList.add(...wanted.filter((name) => !other.includes(name)))
  if (current) anchor.setAttribute('aria-current', 'page')
  else anchor.removeAttribute('aria-current')
  anchor.toggleAttribute('data-active', current)
}
