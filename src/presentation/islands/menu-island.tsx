/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import * as LucideIcons from 'lucide-react'
import type { ComponentType, ReactElement } from 'react'

function kebabToPascalCase(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function resolveLucideIcon(
  iconName: string | undefined
): ComponentType<any> | undefined {
  if (!iconName) return undefined
  const component = (LucideIcons as Record<string, unknown>)[kebabToPascalCase(iconName)]
  if (typeof component === 'function')
    return component as ComponentType<any>
  if (typeof component === 'object' && component !== null)
    return component as ComponentType<any>
  return undefined
}

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
  readonly triggerLabel?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

function MenuItemIcon({ icon }: { readonly icon?: string }): ReactElement | null {
  const Icon = resolveLucideIcon(icon)
  if (!Icon) {
    return null
  }
  return (
    <Icon
      size={16}
      aria-hidden="true"
      className="mr-2 shrink-0"
      data-testid={`menu-item-icon-${icon}`}
    />
  )
}

function renderMenuEntry(item: MenuItem, index: number): ReactElement {
  if (item.separator) {
    return (
      <Menu.Separator
        key={`sep-${index}`}
        className="bg-border my-1 h-px"
      />
    )
  }
  const variantClass =
    item.variant === 'destructive'
      ? 'text-error-fg data-[highlighted]:bg-error-bg'
      : 'text-foreground'
  return (
    <Menu.Item
      key={`item-${index}`}
      disabled={item.disabled}
      className={`data-[highlighted]:bg-background-subtle flex cursor-pointer items-center px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${variantClass}`}
    >
      <MenuItemIcon icon={item.icon} />
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-foreground-subtle ml-4 text-xs">{item.shortcut}</span>
      )}
    </Menu.Item>
  )
}

export default function MenuIsland({
  menuItems = [],
  floatingSide = 'bottom',
  floatingAlign = 'start',
  triggerHtml,
  triggerLabel,
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
          <span>{triggerLabel ?? 'Menu'}</span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side={floatingSide}
          align={floatingAlign}
          sideOffset={4}
        >
          <Menu.Popup className="border-border bg-background-overlay text-foreground min-w-48 rounded-md border py-1 shadow-lg transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {menuItems.map((item, index) => renderMenuEntry(item, index))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
