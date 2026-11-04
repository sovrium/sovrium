/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NavigationMenu } from '@base-ui/react/navigation-menu'
import { cn } from '@/presentation/design/class-merge'
import { NavItemBadge } from '@/presentation/design/nav-item-badge'
import { NavChevronDown } from '@/presentation/design/nav-menu-parts'
import {
  computeNavMenuChildLinkClasses,
  computeNavMenuContentClasses,
  computeNavMenuTriggerClasses,
} from '@/presentation/design/navigation-menu-default-classes'
import type { BadgeVariant } from '@/presentation/design/badge-default-classes'
import type { ReactElement } from 'react'

/**
 * The navigation menu's entries that open a panel, and the panel's links,
 * drawn by `nav-menu-island.tsx`. The panel's `content` and `item` classes
 * arrive from the server, which resolved them from the menu's `classes` and
 * `design.components.navigation-menu`: the panel is drawn outside the menu,
 * so a class on its root never reaches it.
 */

interface NavBadge {
  readonly text: string
  readonly variant?: BadgeVariant
}

interface NavChild {
  readonly label: string
  readonly href?: string
  readonly description?: string
  readonly icon?: string
  readonly badge?: NavBadge
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly rel?: string
}

export interface NavItem {
  readonly label: string
  readonly href?: string
  readonly description?: string
  readonly icon?: string
  readonly badge?: NavBadge
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly rel?: string
  readonly children?: readonly NavChild[]
}

/**
 * A single mega-menu child row: a plain link (`navigation-menu-link`) carrying
 * the authored `target`/`rel`, its label, an optional badge
 * and a description. It is a LINK, not a `menuitem`: a navigation menu is a
 * disclosure of links, so the arrow keys and Tab move through it as they move
 * through any list of links.
 */
function NavDropdownChild({
  child,
  className,
}: {
  readonly child: NavChild
  readonly className?: string
}): ReactElement {
  return (
    <NavigationMenu.Link
      href={child.href ?? '#'}
      target={child.target}
      rel={child.rel}
      aria-describedby={child.target === '_blank' ? 'sovrium-new-tab-notice' : undefined}
      data-slot="navigation-menu-link"
      className={cn(computeNavMenuChildLinkClasses(), className)}
    >
      <span className="text-foreground flex items-center gap-2 leading-none font-medium">
        {child.label}
        {child.badge && (
          <NavItemBadge
            text={child.badge.text}
            variant={child.badge.variant}
          />
        )}
      </span>
      {child.description && (
        <span className="text-muted-foreground line-clamp-2 leading-snug">{child.description}</span>
      )}
    </NavigationMenu.Link>
  )
}

/**
 * One entry that opens a panel: a trigger button (`aria-expanded`, the shared
 * chevron rotating on Base UI's `data-popup-open`) and the panel's content,
 * which Base UI moves into the menu's one viewport while it is open.
 *
 *  - `computeNavMenuTriggerClasses(triggerClassName)` applies
 *    the authored override so the trigger matches the SSR placeholder byte-for-byte.
 *  - the recipe emits a leading `group` so the shared
 *    `NavChevronDown`'s `group-data-[popup-open]:rotate-180` flips on open.
 */
export function NavDropdown({
  item,
  triggerClassName,
  contentClassName,
  itemClassName,
}: {
  readonly item: NavItem
  readonly triggerClassName?: string
  readonly contentClassName?: string
  readonly itemClassName?: string
}): ReactElement {
  return (
    <NavigationMenu.Item data-slot="navigation-menu-item">
      <NavigationMenu.Trigger
        data-slot="navigation-menu-trigger"
        className={computeNavMenuTriggerClasses(triggerClassName)}
      >
        {item.label}
        {item.badge && (
          <NavItemBadge
            text={item.badge.text}
            variant={item.badge.variant}
          />
        )}
        <NavChevronDown />
      </NavigationMenu.Trigger>
      <NavigationMenu.Content
        data-slot="navigation-menu-content"
        className={cn(computeNavMenuContentClasses(), 'w-80 p-2', contentClassName)}
      >
        {item.children?.map((child, childIndex) => (
          <NavDropdownChild
            key={`child-${childIndex}`}
            child={child}
            className={itemClassName}
          />
        ))}
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  )
}
