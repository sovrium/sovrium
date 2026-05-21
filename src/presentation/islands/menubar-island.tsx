/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { cn } from '@/presentation/islands/lib/cn'
import type { ReactElement } from 'react'

interface MenuItem {
  readonly label?: string
  readonly icon?: string
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly separator?: boolean
  readonly variant?: 'default' | 'destructive'
}

interface MenuGroup {
  readonly label: string
  readonly items: readonly MenuItem[]
}

interface MenubarIslandProps {
  readonly menus?: readonly MenuGroup[]
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function MenubarIsland({
  menus = [],
  className,
  id,
  'data-testid': testId,
}: MenubarIslandProps): ReactElement {
  return (
    <div
      role="menubar"
      className={cn('border-border bg-bg-raised flex items-center rounded-md border', className)}
      id={id}
      data-testid={testId}
    >
      {menus.map((menu, menuIndex) => (
        <Menu.Root key={`menu-${menuIndex}`}>
          <Menu.Trigger className="text-fg hover:bg-bg-subtle data-[open]:bg-bg-subtle px-3 py-1.5 text-sm font-medium transition-colors">
            {menu.label}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="start"
              sideOffset={4}
            >
              <Menu.Popup className="border-border bg-bg-overlay text-fg min-w-48 rounded-md border py-1 shadow-lg transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                {menu.items.map((item, itemIndex) =>
                  item.separator ? (
                    <Menu.Separator
                      key={`sep-${itemIndex}`}
                      className="bg-border my-1 h-px"
                    />
                  ) : (
                    <Menu.Item
                      key={`item-${itemIndex}`}
                      disabled={item.disabled}
                      className={`data-[highlighted]:bg-bg-subtle flex cursor-pointer items-center px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${
                        item.variant === 'destructive' ? 'text-error-fg' : 'text-fg'
                      }`}
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-fg-subtle ml-4 text-xs">{item.shortcut}</span>
                      )}
                    </Menu.Item>
                  )
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ))}
    </div>
  )
}
