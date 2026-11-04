/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * The warning a `navigation-menu` earns when a sub-menu entry holds `children`
 * of its own: a menu holds two levels, a top item and its `children`, so a
 * third level validates and is never drawn.
 *
 * A warning, not a refusal: a config that boots today keeps booting. It is
 * printed by `validate`, `start` and `build` beside the deprecation warnings,
 * so the server's startup says the same as `validate`, once. A `bottom-bar`
 * menu is skipped: it holds no sub-menu at all, and is refused for it.
 */

/** One warning: where the third level sits, and what it means. */
export interface NavigationDepthWarning {
  readonly path: string
  readonly message: string
}

const warningAt = (path: string): NavigationDepthWarning => ({
  path,
  message: `${path}: a navigation-menu holds two levels, a top item and its children, so the items listed here are not drawn. Move them into the sub-menu above, or give them a page of their own.`,
})

/** The third levels under one menu's `navItems`, as paths. */
const thirdLevelsOf = (navItems: readonly unknown[], menuPath: string): readonly string[] =>
  navItems.flatMap((item, itemIndex) => {
    if (!isRecord(item) || !Array.isArray(item['children'])) return []
    return (item['children'] as readonly unknown[]).flatMap((child, childIndex) =>
      isRecord(child) && Array.isArray(child['children']) && child['children'].length > 0
        ? [`${menuPath}.navItems[${String(itemIndex)}].children[${String(childIndex)}].children`]
        : []
    )
  })

/** Every third level among the menus under `value`, which sits at `path`. */
const walk = (value: unknown, path: string): readonly string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => walk(item, `${path}[${String(index)}]`))
  }
  if (!isRecord(value)) return []
  const own =
    value['type'] === 'navigation-menu' &&
    value['layout'] !== 'bottom-bar' &&
    Array.isArray(value['navItems'])
      ? thirdLevelsOf(value['navItems'] as readonly unknown[], path)
      : []
  const nested = Object.entries(value)
    .filter(([key]) => key !== 'navItems')
    .flatMap(([key, child]) => walk(child, `${path}.${key}`))
  return [...own, ...nested]
}

/**
 * Every third level a raw config's navigation menus hold, on its pages and in
 * its `components` templates, in declaration order.
 *
 * @param config - The config as parsed, before it is decoded
 * @returns One warning per third level; empty when every menu holds two levels
 */
export const collectNavigationDepthWarnings = (
  config: unknown
): readonly NavigationDepthWarning[] => {
  if (!isRecord(config)) return []
  return (['pages', 'components'] as const)
    .flatMap((root) => walk(config[root], root))
    .map(warningAt)
}
