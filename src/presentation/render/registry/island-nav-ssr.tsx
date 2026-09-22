/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NavChevronDown, NavItemBadge } from '@/presentation/design/nav-menu-parts'
import {
  computeNavMenuTriggerClasses,
  type BadgeVariant,
} from '@/presentation/design/navbar-default-classes'
import type { ReactElement } from 'react'

/** Nav item badge shape (mirrors `NavItemSchema.badge`). */
export type SsrNavBadge = { readonly text: string; readonly variant?: BadgeVariant }

/** The nav-item fields the navigation-menu SSR placeholder renders. */
export type SsrNavItem = {
  readonly label: string
  readonly href?: string
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly rel?: string
  readonly badge?: SsrNavBadge
  readonly children?: readonly unknown[]
}

/**
 * Render a single navigation-menu item in the SSR placeholder with the SAME
 * trigger chrome the hydrated island uses (`computeNavMenuTriggerClasses` +
 * shared chevron + shared badge pill). Rendering the SSR trigger identically to
 * the island is what keeps the trigger box fixed across hydration, so the header
 * row does not reflow; the badge appears as a real pill text
 * node pre-hydration.
 */
export function renderSsrNavItem(
  item: SsrNavItem,
  index: number,
  triggerClassName?: string
): ReactElement {
  const badge = item.badge ? (
    <NavItemBadge
      text={item.badge.text}
      variant={item.badge.variant}
    />
  ) : undefined
  // Item WITH children → the mega-menu trigger (button + chevron), mirroring the
  // hydrated `Menu.Trigger`. Item WITHOUT children → a plain link, mirroring the
  // hydrated `<a>` branch. Both carry the identical trigger chrome — including any
  // authored `triggerClassName` override — so the SSR placeholder and hydrated
  // island emit a byte-identical class list and the header does not reflow
  //; the recipe's `group` marker drives the chevron rotation.
  return item.children && item.children.length > 0 ? (
    <button
      key={index}
      type="button"
      className={computeNavMenuTriggerClasses(triggerClassName)}
    >
      {item.label}
      {badge}
      <NavChevronDown />
    </button>
  ) : (
    <a
      key={index}
      href={item.href}
      target={item.target}
      rel={item.rel}
      className={computeNavMenuTriggerClasses(triggerClassName)}
    >
      {item.label}
      {badge}
    </a>
  )
}
