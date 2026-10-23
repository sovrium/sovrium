/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The navigation default of a static build.
 *
 * A running app swaps page content on an in-app link by default: a `sidebar`
 * that leaves `clientSideNavigation` out takes part. A static host answers no
 * partial request, so `sovrium build` reads that same omission as off, and only
 * an explicit `true` keeps the swap in the exported site.
 *
 * The build hands the renderer an app in which every sidebar that leaves the
 * option out says `false`, rather than telling the renderer which mode it runs
 * in: the render pipeline then needs no build-mode signal, and the running
 * server's reading of the option stays the only one.
 */

type Node = Readonly<Record<string, unknown>>

/** Whether `node` places a template (a `$ref` / `component` name) rather than drawing itself. */
const placesTemplate = (node: Node): boolean =>
  typeof node['$ref'] === 'string' || typeof node['component'] === 'string'

const rewriteList = (items: unknown): unknown =>
  Array.isArray(items) ? items.map((item) => rewriteNode(item)) : items

/** Each breakpoint's `children`, rewritten; the rest of the breakpoint kept as is. */
const rewriteResponsive = (responsive: unknown): unknown => {
  if (responsive === null || typeof responsive !== 'object') return responsive
  return Object.fromEntries(
    Object.entries(responsive).map(([breakpoint, variant]) =>
      variant !== null && typeof variant === 'object' && 'children' in variant
        ? [breakpoint, { ...variant, children: rewriteList(variant.children) }]
        : [breakpoint, variant]
    )
  )
}

function rewriteNode(item: unknown): unknown {
  if (item === null || typeof item !== 'object') return item
  const node = item as Node
  const descended: Node = {
    ...node,
    ...('children' in node ? { children: rewriteList(node['children']) } : {}),
    ...('responsive' in node ? { responsive: rewriteResponsive(node['responsive']) } : {}),
  }
  const optsOut =
    node['type'] === 'sidebar' && !placesTemplate(node) && !('clientSideNavigation' in node)
  return optsOut ? { ...descended, clientSideNavigation: false } : descended
}

/**
 * The app as a static build renders it: every `sidebar` that leaves
 * `clientSideNavigation` out — on a page, in a breakpoint's children, or in a
 * shared template — says `false`. An explicit `true` or `false` is kept.
 *
 * Works on the decoded app and on the authored config alike, since the walk
 * treats every node as a plain object.
 */
export const withStaticBuildNavigation = <
  A extends {
    readonly components?: readonly unknown[]
    readonly pages?: ReadonlyArray<{ readonly components?: readonly unknown[] }>
  },
>(
  app: A
): A =>
  ({
    ...app,
    ...(app.components === undefined ? {} : { components: rewriteList(app.components) }),
    ...(app.pages === undefined
      ? {}
      : {
          pages: app.pages.map((page) =>
            page.components === undefined
              ? page
              : { ...page, components: rewriteList(page.components) }
          ),
        }),
  }) as A
