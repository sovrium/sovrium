/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { cn } from '@/presentation/islands/lib/cn'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
  computeMenuTriggerClasses,
  computeMenubarContainerClasses,
} from './overlay-default-classes'
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
      className={cn(computeMenubarContainerClasses(), className)}
      id={id}
      data-testid={testId}
    >
      {menus.map((menu, menuIndex) => (
        <Menu.Root key={`menu-${menuIndex}`}>
          <Menu.Trigger className={computeMenuTriggerClasses()}>{menu.label}</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="start"
              sideOffset={4}
            >
              <Menu.Popup className={computeMenuPopupClasses()}>
                {menu.items.map((item, itemIndex) =>
                  item.separator ? (
                    <Menu.Separator
                      key={`sep-${itemIndex}`}
                      className={computeMenuSeparatorClasses()}
                    />
                  ) : (
                    <Menu.Item
                      key={`item-${itemIndex}`}
                      disabled={item.disabled}
                      className={computeMenuItemClasses({ variant: item.variant ?? 'default' })}
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-foreground-subtle ml-4 text-xs">{item.shortcut}</span>
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
