/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * App-config normalization — runs BEFORE schema decode so authoring
 * shorthand and legacy property shapes are converted into the canonical
 * forms the AppSchema decoder expects. Pure, side-effect-free; consumed by
 * `start-server.ts` (server boot) and `src/index.ts` (config-file loader).
 *
 * The transforms here are decisions about wire format, not business logic.
 * Each one solves a specific authoring ergonomics problem documented in
 * its own JSDoc.
 */

/**
 * Strategy shorthand mapping from string shorthand to full strategy type name
 *
 * Supports legacy/shorthand formats for auth strategies:
 * - 'emailPassword' → { type: 'emailAndPassword' }
 * - 'magicLink' → { type: 'magicLink' }
 */
const STRATEGY_SHORTHAND_MAP: Readonly<Record<string, string>> = {
  emailPassword: 'emailAndPassword',
  magicLink: 'magicLink',
}

/**
 * Normalize auth strategies from shorthand string format to full object format
 *
 * Accepts:
 * - String shorthand: 'emailPassword' → { type: 'emailAndPassword' }
 * - Full object: { type: 'emailAndPassword' } → unchanged
 */
const normalizeAuthStrategy = (strategy: unknown): unknown => {
  if (typeof strategy === 'string') {
    const type = STRATEGY_SHORTHAND_MAP[strategy]
    return type !== undefined ? { type } : { type: strategy }
  }
  return strategy
}

/**
 * Normalize auth object by normalizing its strategies array (if present)
 */
const normalizeAuth = (auth: Record<string, unknown>): Record<string, unknown> => {
  const { strategies, ...restAuth } = auth
  return Array.isArray(strategies)
    ? { ...restAuth, strategies: strategies.map(normalizeAuthStrategy) }
    : auth
}

/**
 * Normalize a navigation-menu component's children (link components) into navItems
 *
 * The navigation-menu schema uses navItems instead of children.
 * This converts link child components authored in the config into navItems
 * before schema validation strips the children field.
 */
const normalizeNavigationMenuComponent = (component: Record<string, unknown>): unknown => {
  const { children } = component
  if (!Array.isArray(children) || children.length === 0) return component

  const navItems = children
    .filter(
      (child): child is Record<string, unknown> =>
        typeof child === 'object' &&
        child !== null &&
        (child as Record<string, unknown>)['type'] === 'link'
    )
    .map((child) => {
      const childProps = (child['props'] as Record<string, unknown> | undefined) ?? {}
      const { href, ...extraProps } = childProps
      return {
        label:
          typeof child['content'] === 'string' ? child['content'] : String(child['content'] ?? ''),
        ...(href !== undefined ? { href } : {}),
        ...extraProps,
      }
    })

  const { children: _children, ...rest } = component
  return navItems.length > 0 ? { ...rest, navItems } : rest
}

/**
 * Normalize button components with size: 'icon' to a CSS class.
 * 'icon' is not in ComponentSizeSchema so it must be converted before schema validation.
 */
const normalizeButtonIconSize = (comp: Record<string, unknown>): Record<string, unknown> => {
  const isButton = comp['type'] === 'button' || comp['type'] === 'btn'
  if (!isButton || comp['size'] !== 'icon') return comp

  const { size: _size, ...rest } = comp
  const existingProps = (rest['props'] as Record<string, unknown> | undefined) ?? {}
  const existingClassName = existingProps['className'] as string | undefined
  const iconClassName = existingClassName ? `${existingClassName} btn-icon` : 'btn-icon'
  return { ...rest, props: { ...existingProps, className: iconClassName } }
}

/**
 * Recursively normalize navigation-menu components in a component tree
 */
const normalizeComponents = (components: unknown): unknown => {
  if (!Array.isArray(components)) return components

  return components.map((component: unknown) => {
    if (typeof component !== 'object' || component === null) return component
    const comp = component as Record<string, unknown>

    const withIconNormalized = normalizeButtonIconSize(comp)
    const normalized =
      withIconNormalized['type'] === 'navigation-menu'
        ? (normalizeNavigationMenuComponent(withIconNormalized) as Record<string, unknown>)
        : withIconNormalized

    // Recurse into children if present
    if (Array.isArray(normalized['children'])) {
      return { ...normalized, children: normalizeComponents(normalized['children']) }
    }
    return normalized
  })
}

/**
 * Normalize a navigation-menu template by converting it to a flex container
 *
 * Component templates for navigation-menu with link children cannot use navItems
 * (NavItemSchema strips extra HTML attributes like target, rel). Converting to flex
 * preserves all link props since link.props uses an open Schema.Record.
 */
const normalizeNavigationMenuTemplate = (component: Record<string, unknown>): unknown => {
  const { children } = component
  if (!Array.isArray(children) || children.length === 0) return component

  const hasLinkChildren = children.some(
    (child) =>
      typeof child === 'object' &&
      child !== null &&
      (child as Record<string, unknown>)['type'] === 'link'
  )

  if (!hasLinkChildren) return component

  // Convert to flex container so link children with all props (target, rel, etc.) pass validation
  const { type: _type, ...rest } = component
  return { ...rest, type: 'flex' }
}

/**
 * Normalize top-level app component templates
 *
 * Differs from normalizeComponents (used for pages): navigation-menu templates with
 * link children are converted to flex containers rather than navItems, preserving
 * all HTML attributes like target and rel.
 */
const normalizeComponentTemplates = (components: unknown): unknown => {
  if (!Array.isArray(components)) return components

  return components.map((component: unknown) => {
    if (typeof component !== 'object' || component === null) return component
    const comp = component as Record<string, unknown>

    if (comp['type'] === 'navigation-menu') {
      return normalizeNavigationMenuTemplate(comp)
    }

    return comp
  })
}

/**
 * Recursively normalize components within pages
 */
const normalizePages = (pages: unknown): unknown => {
  if (!Array.isArray(pages)) return pages

  return pages.map((page: unknown) => {
    if (typeof page !== 'object' || page === null) return page
    const p = page as Record<string, unknown>

    if (!Array.isArray(p['components'])) return page

    return {
      ...p,
      components: normalizeComponents(p['components']),
    }
  })
}

/**
 * Normalize app configuration to handle shorthand formats
 *
 * Converts legacy/shorthand auth strategy formats to the full object format
 * expected by the schema. This allows users to write:
 *   strategies: ['emailPassword']
 * instead of:
 *   strategies: [{ type: 'emailAndPassword' }]
 *
 * Also converts navigation-menu children (link components) to navItems format,
 * since navigation-menu uses navItems instead of children in the schema.
 */
export const normalizeAppConfig = (app: unknown): unknown => {
  if (typeof app !== 'object' || app === null) return app

  const { auth, pages, components, ...restApp } = app as Record<string, unknown>

  return {
    ...restApp,
    ...(typeof auth === 'object' && auth !== null
      ? { auth: normalizeAuth(auth as Record<string, unknown>) }
      : auth !== undefined
        ? { auth }
        : {}),
    ...(Array.isArray(pages)
      ? { pages: normalizePages(pages) }
      : pages !== undefined
        ? { pages }
        : {}),
    ...(Array.isArray(components)
      ? { components: normalizeComponentTemplates(components) }
      : components !== undefined
        ? { components }
        : {}),
  }
}
