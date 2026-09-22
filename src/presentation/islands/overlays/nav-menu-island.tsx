/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { cn } from '@/presentation/design/class-merge'
import { NavChevronDown, NavItemBadge } from '@/presentation/design/nav-menu-parts'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { computeMenuPopupClasses, computeNavMenuTriggerClasses } from './overlay-default-classes'
import type { BadgeVariant } from '@/presentation/design/navbar-default-classes'
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
  /** Open every mega-menu trigger on pointer hover (in addition to click). */
  readonly openOnHover?: boolean
  /** Authored trigger className that overrides the default trigger recipe. */
  readonly triggerClassName?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * A single mega-menu child row (`Menu.LinkItem`). Threads the authored
 * `target`/`rel` onto the anchor alongside the label,
 * optional badge, and description.
 */
function NavDropdownChild({ child }: { readonly child: NavChild }): ReactElement {
  return (
    <Menu.LinkItem
      href={child.href ?? '#'}
      target={child.target}
      rel={child.rel}
      className="data-[highlighted]:bg-background-subtle text-md flex flex-col rounded-md px-3 py-2 transition-colors outline-none"
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
        <span className="text-foreground-muted mt-0.5 text-sm">{child.description}</span>
      )}
    </Menu.LinkItem>
  )
}

/**
 * [internal ref] (round-4) wiring:
 * - [internal ref]: `openOnHover` opens the mega-menu on pointer hover; a
 *    `closeDelay` lets the pointer travel from the trigger into the open panel.
 * - [internal ref]: each child's `target`/`rel` are threaded onto its
 *    `Menu.LinkItem` anchor (and the plain-link leaf branch below).
 * - [internal ref]: `computeNavMenuTriggerClasses(triggerClassName)` applies
 *    the authored override so the trigger matches the SSR placeholder byte-for-byte.
 * - [internal ref]: the recipe emits a leading `group` so the shared
 *    `NavChevronDown`'s `group-data-[popup-open]:rotate-180` flips on open.
 *
 * `closeDelay` is intentionally ~150ms when `openOnHover` is on: it keeps the
 * menu open while the pointer crosses the gap from the trigger to the panel
 * (the spec hovers the trigger, then hovers a panel item, expecting it to stay
 * open). Base UI's default `closeDelay` is 0, which would snap the menu shut.
 */
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
          // z-[above the sticky header]: Base UI's Positioner is `z-auto` and,
          // because Floating UI gives it a `transform`, it forms a stacking
          // context that traps the popup's own `z-50` — so the popup paints
          // BELOW a `sticky z-40` header. Lifting the Positioner above the
          // header (z-50 > z-40) hoists the whole popup subtree over it
          //.
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

/**
 * Navigation menu island — renders a mega-menu style navigation.
 *
 * Top-level items with no children render as direct links.
 * Items with children open a dropdown panel showing label + description.
 * Built using Base UI Menu for each dropdown section.
 *
 * The wrapper is a `div` (NOT `<nav>`): the island mounts INSIDE the SSR
 * host marker, and the standard header composition embeds the component in
 * an authored `<nav>` — a nested `<nav>` here would double the navigation
 * landmark count. Menus carry their own ARIA roles.
 */
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
      className={resolveClasses('flex items-center gap-1', className)}
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
