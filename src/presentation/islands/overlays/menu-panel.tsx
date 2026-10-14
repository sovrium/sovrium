/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useCallback, type ReactElement, type ReactNode, type RefObject } from 'react'
import { authClient } from '@/presentation/islands/runtime/auth-client'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
} from './menu-default-classes'
import { PlainMenuItem, NavigateMenuItem } from './menu-entries'
import { MenuItemBody } from './menu-popup-body'
import { MenuHeading, RadioMenuGroup } from './menu-radio-entries'
import { gatherMenuEntries } from './menu-radio-runs'
import { MenuKindProvider, useMenuKind, type MenuKind } from './menu-slot-context'
import { ToggleMenuItem } from './menu-toggle-item'
import type { MenuItem, MenuSurface } from './menu-item-types'

/**
 * The floating half of a menu: its portal, positioner, popup and rows.
 *
 * Shared by the two islands that draw a menu panel from `menuItems` — the
 * button-anchored `dropdown-menu` (`menu-island.tsx`) and the pointer-anchored
 * `context-menu` (`context-menu-island.tsx`). Base UI's context menu reuses the
 * Menu parts below its own root, so one panel serves both: inside a
 * `ContextMenu.Root` the positioner anchors at the pointer, inside a
 * `Menu.Root` at the trigger.
 */

/** Sign out, then return to `redirectTo` regardless of the sign-out outcome. */
async function performLogout(redirectTo: string): Promise<void> {
  try {
    await authClient.signOut()
  } finally {
    window.location.assign(redirectTo)
  }
}

/** A menu item that signs the operator out via the config `auth` `logout` action. */
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
  const kind = useMenuKind()
  return (
    <Menu.Item
      data-slot={`${kind}-item`}
      data-variant={item.variant ?? 'default'}
      disabled={item.disabled}
      onClick={handleClick}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
    </Menu.Item>
  )
}

/** A `*-separator` hairline, named after the menu it sits in. */
function MenuSeparator(): ReactElement {
  const kind = useMenuKind()
  return (
    <Menu.Separator
      data-slot={`${kind}-separator`}
      className={computeMenuSeparatorClasses()}
    />
  )
}

/** Where the menu sits on the page: the overlay around it is the one an item's `close` closes. */
export type MenuHost = RefObject<HTMLDivElement | null>

/** Render a single menu entry, dispatching on separator / toggle / action / plain item. */
function renderMenuEntry(
  item: MenuItem,
  index: number,
  surface: MenuSurface,
  host: MenuHost
): ReactElement {
  if (item.separator) {
    return <MenuSeparator key={`sep-${index}`} />
  }
  if (item.heading === true) {
    return <MenuHeading key={`heading-${index}`}>{item.label}</MenuHeading>
  }
  // BEFORE the action branches, deliberately: a row that declares `toggle` is a
  // toggle whatever else it carries. The two action branches below both change
  // what the row IS — `navigate` renders it as an anchor — and a checkbox item
  // that walks away from the page on every flip is not a toggle. An `action`
  // alongside `toggle` is therefore inert, which is the same precedence
  // `separator` already has over `label`, `icon` and `action`.
  if (item.toggle !== undefined) {
    return (
      <ToggleMenuItem
        key={`item-${index}`}
        item={item}
        surface={surface}
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
      host={host}
    />
  )
}

/** The floating panel: the items, plus whatever quiet line sits under them. */
export function MenuPanel({
  menuItems,
  floatingSide,
  floatingAlign,
  popupVariant,
  footerContent,
  host,
  kind,
  sideOffset = 4,
  alignOffset,
}: {
  readonly kind: MenuKind
  /** Gap from the anchor along `floatingSide`: 4 px under a button, 0 at a pointer. */
  readonly sideOffset?: number
  /** Shift along the anchor edge: shadcn's context menu nudges 4 px off the pointer. */
  readonly alignOffset?: number
  readonly host: MenuHost
  readonly menuItems: readonly MenuItem[]
  readonly floatingSide: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign: 'start' | 'center' | 'end'
  readonly popupVariant: MenuSurface
  readonly footerContent?: ReactNode
}): ReactElement {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={floatingSide}
        align={floatingAlign}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        // Lift the Positioner above a `sticky z-40` header (z-50 > z-40): its
        // Floating-UI `transform` forms a stacking context that would otherwise
        // trap the popup's own `z-50` below the header.
        className="isolate z-50 outline-none"
      >
        <Menu.Popup
          data-slot={`${kind}-content`}
          className={computeMenuPopupClasses({ variant: popupVariant, kind })}
        >
          <MenuKindProvider value={kind}>
            {gatherMenuEntries(menuItems).map((entry) =>
              entry.kind === 'radio' ? (
                <RadioMenuGroup
                  key={`radio-${entry.group}-${String(entry.rows[0]?.index)}`}
                  rows={entry.rows}
                  surface={popupVariant}
                />
              ) : (
                renderMenuEntry(entry.item, entry.index, popupVariant, host)
              )
            )}
            {footerContent}
          </MenuKindProvider>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}
