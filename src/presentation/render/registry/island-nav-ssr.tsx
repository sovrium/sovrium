/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment, type ReactElement } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { NavItemBadge } from '@/presentation/design/nav-item-badge'
import { NavChevronDown } from '@/presentation/design/nav-menu-parts'
import {
  computeNavMenuChildLinkClasses,
  computeNavMenuContentClasses,
  computeNavMenuTriggerClasses,
  navPanelId,
} from '@/presentation/design/navigation-menu-default-classes'
import { describeNewTab } from '@/presentation/design/new-tab-attributes'
import type { MenuPanelPartClasses } from './menu-panel-parts'
import type { BadgeVariant } from '@/presentation/design/badge-default-classes'

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

/** A panel entry as the served page draws it: a link to a destination. */
type SsrNavChild = SsrNavItem & { readonly description?: string }

/**
 * The panel of an item with children, as the served page draws it: a native
 * popover holding the panel's destinations as plain links, so a reader without
 * scripts — and a search engine — reaches each one. The island replaces it when
 * it mounts.
 */
function renderSsrNavPanel(
  item: SsrNavItem,
  id: string,
  parts: MenuPanelPartClasses
): ReactElement {
  const links = (item.children ?? []) as readonly SsrNavChild[]
  return (
    <div
      id={id}
      popover="auto"
      data-slot="navigation-menu-content"
      className={cn(computeNavMenuContentClasses(), parts.contentClassName)}
    >
      {links
        .filter((link) => link.href !== undefined)
        .map((link) => (
          <a
            key={link.href}
            href={link.href}
            target={link.target}
            rel={link.rel}
            {...describeNewTab(link.target)}
            data-slot="navigation-menu-link"
            className={cn(computeNavMenuChildLinkClasses(), parts.itemClassName)}
          >
            <span className="font-medium">{link.label}</span>
            {link.description === undefined ? undefined : (
              <span className="text-muted-foreground">{link.description}</span>
            )}
          </a>
        ))}
    </div>
  )
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
  classes: MenuPanelPartClasses & { readonly triggerClassName?: string } = {}
): ReactElement {
  const { triggerClassName } = classes
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
  // The recipe's `group` marker drives the chevron rotation.
  // Before the island mounts the trigger opens its served panel natively
  // (`popovertarget`), so the menu works without scripts.
  return item.children && item.children.length > 0 ? (
    <Fragment key={index}>
      <button
        type="button"
        popoverTarget={navPanelId(item, index)}
        data-slot="navigation-menu-trigger"
        className={computeNavMenuTriggerClasses(triggerClassName)}
      >
        {item.label}
        {badge}
        <NavChevronDown />
      </button>
      {renderSsrNavPanel(item, navPanelId(item, index), classes)}
    </Fragment>
  ) : (
    <a
      key={index}
      href={item.href}
      target={item.target}
      rel={item.rel}
      {...describeNewTab(item.target)}
      data-slot="navigation-menu-link"
      className={computeNavMenuTriggerClasses(triggerClassName)}
    >
      {item.label}
      {badge}
    </a>
  )
}
