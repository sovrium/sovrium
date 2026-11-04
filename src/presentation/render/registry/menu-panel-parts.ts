/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

/**
 * The classes a menu's open panel and its rows take, read off the resolved
 * `design.components.<type>` under the node's `classes`.
 *
 * A `navigation-menu` or `dropdown-menu` draws its panel in a portal at the end
 * of the page, so a class on the menu's root never reaches it: the `content`
 * and `item` parts cross to the island as their own props, and the served
 * panel (a navigation menu's, before the island mounts) takes the same lists.
 * Each key is present only when the part says something, so a menu that names
 * neither ships the props it shipped before.
 */
export interface MenuPanelPartClasses {
  /** The open panel (`*-content`). */
  readonly contentClassName?: string
  /** Each row in the panel: a navigation menu's links, a dropdown's entries. */
  readonly itemClassName?: string
}

const partOf = (
  styles: ComponentDesignResolution | undefined,
  part: 'content' | 'item'
): string | undefined => {
  const classes = [styles?.parts[part], styles?.partFloors[part]]
    .filter((value) => value !== undefined && value !== '')
    .join(' ')
  return classes === '' ? undefined : classes
}

/**
 * The `content` and `item` part classes of a menu, as island props.
 *
 * @param styles - The menu's `designStyles`, if any.
 * @returns `contentClassName` / `itemClassName`, each only when non-empty.
 */
export const menuPanelPartClasses = (
  styles: ComponentDesignResolution | undefined
): MenuPanelPartClasses => {
  const contentClassName = partOf(styles, 'content')
  const itemClassName = partOf(styles, 'item')
  return {
    ...(contentClassName === undefined ? {} : { contentClassName }),
    ...(itemClassName === undefined ? {} : { itemClassName }),
  }
}
