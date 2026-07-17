/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { cn } from '@/presentation/islands/lib/cn'
import { NavChevronDown, NavItemBadge } from '@/presentation/utils/recipes/nav-menu-parts'
import { computeMenuPopupClasses, computeNavMenuTriggerClasses } from './overlay-default-classes'
import type { BadgeVariant } from '@/presentation/utils/recipes/navbar-default-classes'
import type { ReactElement } from 'react'

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

interface NavItem {
  readonly label: string
  readonly href?: string
  readonly description?: string
  readonly icon?: string
  readonly badge?: NavBadge
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly rel?: string
  readonly children?: readonly NavChild[]
}

interface NavMenuIslandProps {
  readonly navItems?: readonly NavItem[]
  readonly openOnHover?: boolean
  readonly triggerClassName?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

function NavDropdownChild({ child }: { readonly child: NavChild }): ReactElement {
  return (
    <Menu.LinkItem
      href={child.href ?? '#'}
      target={child.target}
      rel={child.rel}
      className="data-[highlighted]:bg-background-subtle flex flex-col rounded-md px-3 py-2 text-sm transition-colors outline-none"
    >
      <span className="text-foreground flex items-center gap-2 font-medium">
        {child.label}
        {child.badge && (
          <NavItemBadge
            text={child.badge.text}
            variant={child.badge.variant}
          />
        )}
      </span>
      {child.description && (
        <span className="text-foreground-muted mt-0.5 text-xs">{child.description}</span>
      )}
    </Menu.LinkItem>
  )
}

function NavDropdown({
  item,
  index,
  openOnHover,
  triggerClassName,
}: {
  readonly item: NavItem
  readonly index: number
  readonly openOnHover?: boolean
  readonly triggerClassName?: string
}): ReactElement {
  return (
    <Menu.Root key={`nav-${index}`}>
      <Menu.Trigger
        className={computeNavMenuTriggerClasses(triggerClassName)}
        openOnHover={openOnHover}
        closeDelay={openOnHover ? 150 : undefined}
      >
        {item.label}
        {item.badge && (
          <NavItemBadge
            text={item.badge.text}
            variant={item.badge.variant}
          />
        )}
        <NavChevronDown />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-50"
        >
          <Menu.Popup className={cn(computeMenuPopupClasses(), 'w-80 p-2')}>
            {item.children?.map((child, childIndex) => (
              <NavDropdownChild
                key={`child-${childIndex}`}
                child={child}
              />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export default function NavMenuIsland({
  navItems = [],
  openOnHover,
  triggerClassName,
  className,
  id,
  'data-testid': testId,
}: NavMenuIslandProps): ReactElement {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      id={id}
      data-testid={testId}
    >
      {navItems.map((item, index) =>
        item.children && item.children.length > 0 ? (
          <NavDropdown
            key={`nav-${index}`}
            item={item}
            index={index}
            openOnHover={openOnHover}
            triggerClassName={triggerClassName}
          />
        ) : (
          <a
            key={`nav-${index}`}
            href={item.href ?? '#'}
            target={item.target}
            rel={item.rel}
            className={computeNavMenuTriggerClasses(triggerClassName)}
          >
            {item.label}
            {item.badge && (
              <NavItemBadge
                text={item.badge.text}
                variant={item.badge.variant}
              />
            )}
          </a>
        )
      )}
    </div>
  )
}
