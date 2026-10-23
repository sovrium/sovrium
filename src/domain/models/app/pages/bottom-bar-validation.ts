/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `navigation-menu` drawn as a phone's tab bar (`layout: bottom-bar`)
 * may hold: at most five top-level items, none of them a sub-menu.
 *
 * Both are cross-key rules — `layout` decides what `navItems` may be — so they
 * are judged here, over the page's walked nodes, rather than on either key.
 * Five is the most a phone's width shows as tabs a thumb can hit; a sub-menu
 * has nowhere to open in a bar fixed to the foot of the screen.
 */

/** The most tabs a bottom bar holds. */
const MAX_BOTTOM_BAR_ITEMS = 5

/** Every violation of the bottom-bar rules among `nodes`, empty when they hold. */
export function bottomBarViolations(
  nodes: readonly Readonly<Record<string, unknown>>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => node['type'] === 'navigation-menu' && node['layout'] === 'bottom-bar')
    .flatMap((node) => {
      const items = Array.isArray(node['navItems']) ? node['navItems'] : []
      const tooMany =
        items.length > MAX_BOTTOM_BAR_ITEMS
          ? [
              `${label} declares a navigation-menu with layout bottom-bar and ${String(items.length)} items — a bottom-bar holds at most five, the most a phone shows as tabs. Keep five, or move the rest to a menu or a page`,
            ]
          : []
      const subMenus = items.flatMap((item: unknown) =>
        isRecord(item) && Array.isArray(item['children']) && item['children'].length > 0
          ? [
              `${label} declares a navigation-menu with layout bottom-bar whose item "${String(item['label'])}" holds a sub-menu — a tab fixed to the foot of the screen has nowhere to open one. Give the item an href, or use layout header`,
            ]
          : []
      )
      return [...tooMany, ...subMenus]
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
