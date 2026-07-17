/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useCallback, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
import { authClient } from '@/presentation/islands/shared/auth-client'
import { resolveLucideIcon } from '@/presentation/utils/lucide-resolver'
import { NavChevronDown } from '@/presentation/utils/recipes/nav-menu-parts'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
} from './overlay-default-classes'

type MenuSurface = 'default' | 'inverted'

interface MenuItemAction {
  readonly type?: string
  readonly method?: string
  readonly path?: string
  readonly onSuccess?: { readonly navigate?: string }
}

interface MenuItem {
  readonly label?: string
  readonly icon?: string
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly separator?: boolean
  readonly variant?: 'default' | 'destructive'
  readonly action?: MenuItemAction
}

interface MenuIslandProps {
  readonly menuItems?: readonly MenuItem[]
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly triggerHtml?: string
  readonly triggerLabel?: string
  readonly triggerContent?: ReactNode
  readonly triggerClassName?: string
  readonly triggerAriaLabel?: string
  readonly popupVariant?: MenuSurface
  readonly openOnHover?: boolean
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

async function performLogout(redirectTo: string): Promise<void> {
  try {
    await authClient.signOut()
  } finally {
    window.location.assign(redirectTo)
  }
}

function isExternalPath(path: string): boolean {
  return /^https?:\/\//i.test(path)
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

function MenuItemBody({ item }: { readonly item: MenuItem }): ReactElement {
  return (
    <>
      <MenuItemIcon icon={item.icon} />
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-foreground-subtle ml-4 text-xs">{item.shortcut}</span>
      )}
    </>
  )
}

function PlainMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  return (
    <Menu.Item
      disabled={item.disabled}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
    </Menu.Item>
  )
}

function LogoutMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  const redirectTo = item.action?.onSuccess?.navigate ?? '/'
  const handleClick = useCallback(() => {
    void performLogout(redirectTo)
  }, [redirectTo])
  return (
    <Menu.Item
      disabled={item.disabled}
      onClick={handleClick}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
    </Menu.Item>
  )
}

function NavigateMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  const path = item.action?.path ?? '#'
  const external = isExternalPath(path)
  const anchor = external ? (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
    />
  ) : (
    <a href={path} />
  )
  return (
    <Menu.Item
      disabled={item.disabled}
      render={anchor}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
    </Menu.Item>
  )
}

function renderMenuEntry(item: MenuItem, index: number, surface: MenuSurface): ReactElement {
  if (item.separator) {
    return (
      <Menu.Separator
        key={`sep-${index}`}
        className={computeMenuSeparatorClasses()}
      />
    )
  }
  const { action } = item
  if (action?.type === 'auth' && action.method === 'logout') {
    return (
      <LogoutMenuItem
        key={`item-${index}`}
        item={item}
        surface={surface}
      />
    )
  }
  if (action?.type === 'navigate') {
    return (
      <NavigateMenuItem
        key={`item-${index}`}
        item={item}
        surface={surface}
      />
    )
  }
  return (
    <PlainMenuItem
      key={`item-${index}`}
      item={item}
      surface={surface}
    />
  )
}

function TriggerContent({
  triggerContent,
  triggerHtml,
  triggerLabel,
}: {
  readonly triggerContent?: ReactNode
  readonly triggerHtml?: string
  readonly triggerLabel?: string
}): ReactNode {
  if (triggerContent !== undefined) return triggerContent
  if (triggerHtml) {
    return <span dangerouslySetInnerHTML={{ __html: triggerHtml }} />
  }
  return (
    <>
      <span>{triggerLabel ?? 'Menu'}</span>
      {triggerLabel !== undefined && <NavChevronDown />}
    </>
  )
}

export default function MenuIsland({
  menuItems = [],
  floatingSide = 'bottom',
  floatingAlign = 'start',
  triggerHtml,
  triggerLabel,
  triggerContent,
  triggerClassName,
  triggerAriaLabel,
  popupVariant = 'default',
  openOnHover,
  className,
  id,
  'data-testid': testId,
}: MenuIslandProps): ReactElement {
  const hoverEnabled = triggerLabel !== undefined && openOnHover === true
  return (
    <div data-component-type="dropdown-menu">
      <Menu.Root>
        <Menu.Trigger
          className={cn('group', triggerClassName ?? className)}
          aria-label={triggerAriaLabel}
          id={id}
          data-testid={testId}
          openOnHover={hoverEnabled}
          closeDelay={hoverEnabled ? 150 : undefined}
        >
          <TriggerContent
            triggerContent={triggerContent}
            triggerHtml={triggerHtml}
            triggerLabel={triggerLabel}
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            side={floatingSide}
            align={floatingAlign}
            sideOffset={4}
            className="z-50"
          >
            <Menu.Popup className={computeMenuPopupClasses({ variant: popupVariant })}>
              {menuItems.map((item, index) => renderMenuEntry(item, index, popupVariant))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}
