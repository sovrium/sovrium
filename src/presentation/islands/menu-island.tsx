/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import type { ReactElement } from 'react'

interface MenuItem {
  readonly label?: string
  readonly icon?: string
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly separator?: boolean
  readonly variant?: 'default' | 'destructive'
}

interface MenuIslandProps {
  readonly menuItems?: readonly MenuItem[]
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly triggerHtml?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function MenuIsland({
  menuItems = [],
  floatingSide = 'bottom',
  floatingAlign = 'start',
  triggerHtml,
  className,
  id,
  'data-testid': testId,
}: MenuIslandProps): ReactElement {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={className}
        id={id}
        data-testid={testId}
      >
        {triggerHtml ? (
          <span dangerouslySetInnerHTML={{ __html: triggerHtml }} />
        ) : (
          <span>Menu</span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side={floatingSide}
          align={floatingAlign}
          sideOffset={4}
        >
          <Menu.Popup className="border-border bg-bg-overlay text-fg min-w-48 rounded-md border py-1 shadow-lg transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {menuItems.map((item, index) =>
              item.separator ? (
                <Menu.Separator
                  key={`sep-${index}`}
                  className="bg-border my-1 h-px"
                />
              ) : (
                <Menu.Item
                  key={`item-${index}`}
                  disabled={item.disabled}
                  className={`data-[highlighted]:bg-bg-subtle flex cursor-pointer items-center px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${
                    item.variant === 'destructive'
                      ? 'text-error-fg data-[highlighted]:bg-error-bg'
                      : 'text-fg'
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
  )
}
