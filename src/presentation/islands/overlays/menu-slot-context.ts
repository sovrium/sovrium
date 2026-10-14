/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'

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
