/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { cn } from '@/presentation/islands/lib/cn'
import type { ReactElement } from 'react'

interface NavChild {
  readonly label: string
  readonly href?: string
  readonly description?: string
  readonly icon?: string
}

interface NavItem {
  readonly label: string
  readonly href?: string
  readonly description?: string
  readonly icon?: string
  readonly children?: readonly NavChild[]
}

interface NavMenuIslandProps {
  readonly navItems?: readonly NavItem[]
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

function ChevronDown(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="text-foreground-muted"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NavDropdown({
  item,
  index,
}: {
  readonly item: NavItem
  readonly index: number
}): ReactElement {
  return (
    <Menu.Root key={`nav-${index}`}>
      <Menu.Trigger className="text-foreground hover:bg-background-subtle hover:text-foreground inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors">
        {item.label}
        <ChevronDown />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <Menu.Popup className="border-border bg-background-overlay text-foreground w-80 rounded-lg border p-2 shadow-lg transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {item.children?.map((child, childIndex) => (
              <Menu.LinkItem
                key={`child-${childIndex}`}
                href={child.href ?? '#'}
                className="data-[highlighted]:bg-background-subtle flex flex-col rounded-md px-3 py-2 text-sm transition-colors outline-none"
              >
                <span className="text-foreground font-medium">{child.label}</span>
                {child.description && (
                  <span className="text-foreground-muted mt-0.5 text-xs">{child.description}</span>
                )}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export default function NavMenuIsland({
  navItems = [],
  className,
  id,
  'data-testid': testId,
}: NavMenuIslandProps): ReactElement {
  return (
    <nav
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
          />
        ) : (
          <a
            key={`nav-${index}`}
            href={item.href ?? '#'}
            className="text-foreground hover:bg-background-subtle hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
          >
            {item.label}
          </a>
        )
      )}
    </nav>
  )
}
