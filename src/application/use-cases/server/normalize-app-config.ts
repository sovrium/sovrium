/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const STRATEGY_SHORTHAND_MAP: Readonly<Record<string, string>> = {
  emailPassword: 'emailAndPassword',
  magicLink: 'magicLink',
}

const normalizeAuthStrategy = (strategy: unknown): unknown => {
  if (typeof strategy === 'string') {
    const type = STRATEGY_SHORTHAND_MAP[strategy]
    return type !== undefined ? { type } : { type: strategy }
  }
  return strategy
}

const normalizeAuth = (auth: Record<string, unknown>): Record<string, unknown> => {
  const { strategies, ...restAuth } = auth
  return Array.isArray(strategies)
    ? { ...restAuth, strategies: strategies.map(normalizeAuthStrategy) }
    : auth
}

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

const normalizeButtonIconSize = (comp: Record<string, unknown>): Record<string, unknown> => {
  const isButton = comp['type'] === 'button' || comp['type'] === 'btn'
  if (!isButton || comp['size'] !== 'icon') return comp

  const { size: _size, ...rest } = comp
  const existingProps = (rest['props'] as Record<string, unknown> | undefined) ?? {}
  const existingClassName = existingProps['className'] as string | undefined
  const iconClassName = existingClassName ? `${existingClassName} btn-icon` : 'btn-icon'
  return { ...rest, props: { ...existingProps, className: iconClassName } }
}

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

    if (Array.isArray(normalized['children'])) {
      return { ...normalized, children: normalizeComponents(normalized['children']) }
    }
    return normalized
  })
}

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

  const { type: _type, ...rest } = component
  return { ...rest, type: 'flex' }
}

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
