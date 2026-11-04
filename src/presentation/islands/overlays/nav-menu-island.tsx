/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NavigationMenu } from '@base-ui/react/navigation-menu'
import { NavItemBadge } from '@/presentation/design/nav-item-badge'
import {
  computeNavMenuPopupClasses,
  computeNavMenuTriggerClasses,
} from '@/presentation/design/navigation-menu-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { NavDropdown, type NavItem } from './nav-menu-dropdown'
import { useServedNavPanel } from './use-served-nav-panel'
import type { ReactElement } from 'react'

interface NavMenuIslandProps {
  readonly navItems?: readonly NavItem[]
  /** Open every mega-menu trigger on pointer hover (in addition to click). */
  readonly openOnHover?: boolean
  /** Authored trigger className that overrides the default trigger recipe. */
  readonly triggerClassName?: string
  /** The `content` part: the open panel, drawn outside the menu. */
  readonly contentClassName?: string
  /** The `item` part: each link in the panel. */
  readonly itemClassName?: string
  readonly className?: string
  readonly id?: string
}

/**
 * Hover-open delay without `openOnHover`. Base UI's navigation menu always wires
 * hover and offers no switch, so a click-only menu pushes the rest delay to the
 * largest timer a browser keeps (2^31 - 1 ms); `mouseleave` clears it.
 */
const CLICK_ONLY_HOVER_DELAY = 2_147_483_647

/** How long a hover-opened panel waits before closing as the pointer travels into it. */
const HOVER_CLOSE_DELAY = 150

/** A top-level entry with no panel: a link drawn as a trigger. */
function NavTopLink({
  item,
  triggerClassName,
}: {
  readonly item: NavItem
  readonly triggerClassName?: string
}): ReactElement {
  return (
    <NavigationMenu.Item data-slot="navigation-menu-item">
      <NavigationMenu.Link
        href={item.href ?? '#'}
        target={item.target}
        rel={item.rel}
        aria-describedby={item.target === '_blank' ? 'sovrium-new-tab-notice' : undefined}
        data-slot="navigation-menu-link"
        className={computeNavMenuTriggerClasses(triggerClassName)}
      >
        {item.label}
        {item.badge && (
          <NavItemBadge
            text={item.badge.text}
            variant={item.badge.variant}
          />
        )}
      </NavigationMenu.Link>
    </NavigationMenu.Item>
  )
}

/** Where every open panel is drawn: one viewport, sized to the content it holds. */
function NavMenuViewport(): ReactElement {
  return (
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner
        side="bottom"
        align="start"
        sideOffset={8}
        // z-[above the sticky header]: Floating UI gives the Positioner a
        // `transform`, so it forms a stacking context that would trap the
        // popup's own stacking below a `sticky z-40` header. Lifting the
        // Positioner to z-50 hoists the whole panel over it.
        className="isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)"
      >
        <NavigationMenu.Popup className={computeNavMenuPopupClasses()}>
          <NavigationMenu.Viewport className="relative size-full overflow-hidden" />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  )
}

/**
 * Navigation menu island — shadcn/ui's Navigation Menu on Base UI
 * `NavigationMenu`: links, and disclosure triggers (`aria-expanded`) whose
 * panel is a list of links — never `menu`/`menuitem` roles.
 *
 * The root renders a `div` (Base UI's default is `<nav>`): the island mounts
 * inside the SSR host, and the header composition wraps it in an authored
 * `<nav>`, which must stay the page's only navigation landmark.
 * The root does not repeat the authored `data-testid`: the SSR host carries it.
 */
export default function NavMenuIsland({
  navItems = [],
  openOnHover,
  triggerClassName,
  contentClassName,
  itemClassName,
  className,
  id,
}: NavMenuIslandProps): ReactElement {
  useServedNavPanel(navItems)
  return (
    <NavigationMenu.Root
      render={<div />}
      id={id}
      className="relative"
      delay={openOnHover === true ? undefined : CLICK_ONLY_HOVER_DELAY}
      closeDelay={openOnHover === true ? HOVER_CLOSE_DELAY : undefined}
    >
      <NavigationMenu.List
        data-slot="navigation-menu-list"
        className={resolveClasses('flex items-center gap-1', className)}
      >
        {navItems.map((item, index) =>
          item.children && item.children.length > 0 ? (
            <NavDropdown
              key={`nav-${index}`}
              item={item}
              triggerClassName={triggerClassName}
              contentClassName={contentClassName}
              itemClassName={itemClassName}
            />
          ) : (
            <NavTopLink
              key={`nav-${index}`}
              item={item}
              triggerClassName={triggerClassName}
            />
          )
        )}
      </NavigationMenu.List>
      <NavMenuViewport />
    </NavigationMenu.Root>
  )
}
