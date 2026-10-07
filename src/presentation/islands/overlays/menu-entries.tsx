/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { computeMenuItemClasses } from './menu-default-classes'
import { MenuItemBody } from './menu-popup-body'
import type { MenuItem, MenuSurface } from './menu-item-types'
import type { ReactElement } from 'react'

/**
 * Two kinds of entry a menu draws: a plain item, and an item that navigates,
 * inside the app or out of it.
 */

/** True when a navigate path leaves the app (an absolute http(s) URL). */
function isExternalPath(path: string): boolean {
  return /^https?:\/\//i.test(path)
}

/** A plain (or inert-action) menu item — label/icon/shortcut, no behaviour. */
export function PlainMenuItem({
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

/**
 * A `navigate` menu item — Base UI renders the whole row as the anchor so
 * keyboard activation follows the href (external links open a new tab).
 */
export function NavigateMenuItem({
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
