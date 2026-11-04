/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { computeMenuItemClasses } from './menu-default-classes'

/**
 * Which menu a row is drawn in. shadcn/ui names a menu's parts after the menu
 * (`dropdown-menu-item`, `context-menu-item`, `menubar-item`), while Sovrium
 * draws all three with the same rows; the panel provides its kind and each row
 * reads it to name its `data-slot`.
 */
export type MenuKind = 'dropdown-menu' | 'context-menu' | 'menubar'

const MenuKindContext = createContext<MenuKind>('dropdown-menu')

/** Provides the menu kind to the rows drawn inside it. */
export const MenuKindProvider = MenuKindContext.Provider

/** The kind of menu the calling row sits in (`dropdown-menu` by default). */
export const useMenuKind = (): MenuKind => useContext(MenuKindContext)

const MenuItemClassContext = createContext<string | undefined>(undefined)

/**
 * Provides the `item` part's classes (`design.components.dropdown-menu.parts.item`
 * under the node's own) to the rows of a panel drawn outside the menu.
 */
export const MenuItemClassProvider = MenuItemClassContext.Provider

/**
 * A row's class list: the menu row recipe, then the `item` part's classes, merged
 * so an author's utility replaces the recipe's own rather than racing it.
 */
export const useMenuItemClasses = (
  options: Parameters<typeof computeMenuItemClasses>[0]
): string => {
  const item = useContext(MenuItemClassContext)
  const recipe = computeMenuItemClasses(options)
  return item === undefined ? recipe : cn(recipe, item)
}
