/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The app's MARK, drawn into a tile a page reserves for it.
 *
 * A component whose props carry `data-app-mark` is a tile that stands for the
 * app SERVING the page — for the mounted console, the operator's app, which
 * the console's own config cannot name. This pass fills it:
 *
 *  - with `design.logo` declared, the logo: `src` in the light scheme and
 *    `srcDark` (when declared) in the dark one, each named by the logo's `alt`;
 *  - without one, a monogram of the display name (`monogramOf`) written into
 *    the tile itself, which is then `aria-hidden`: the display name printed
 *    beside it names the app, and the letters would only repeat it.
 *
 * The tile reports which it drew in `data-app-mark` (`logo` / `monogram`), so
 * its classes can address either. It is the rendering rule for an identity the
 * config already declares, not a new key: nothing here is authored.
 */

import { displayNameOf, monogramOf } from '@/domain/models/app/display-name-service'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** The prop that reserves a tile for the app's mark. */
const MARK_PROP = 'data-app-mark'

type Node = Readonly<Record<string, unknown>> & {
  readonly props?: Readonly<Record<string, unknown>>
  readonly children?: readonly unknown[]
}

/** The two logo images, one per scheme; a logo without `srcDark` draws in both. */
const logoChildren = (logo: NonNullable<NonNullable<App['design']>['logo']>): readonly Node[] => {
  const image = (src: string, className: string): Node => ({
    type: 'image',
    props: { src, alt: logo.alt, className },
  })
  return logo.srcDark === undefined
    ? [image(logo.src, 'block size-full object-contain')]
    : [
        image(logo.src, 'block size-full object-contain dark:hidden'),
        image(logo.srcDark, 'hidden size-full object-contain dark:block'),
      ]
}

/** The tile, filled with the app's logo or its monogram. */
const fillTile = (node: Node, app: App): Node => {
  const logo = app.design?.logo
  if (logo !== undefined) {
    return { ...node, props: { ...node.props, [MARK_PROP]: 'logo' }, children: logoChildren(logo) }
  }
  return {
    ...node,
    props: {
      ...node.props,
      [MARK_PROP]: 'monogram',
      'data-testid': 'sidebar-monogram',
      'aria-hidden': 'true',
    },
    children: [monogramOf(displayNameOf(app))],
  }
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTile = (value: unknown): value is Node =>
  isNode(value) && isNode(value.props) && value.props[MARK_PROP] !== undefined

/**
 * Fill every reserved tile under `value`, at any depth and in any slot — a
 * sidebar keeps its head in `header`, not in `children`, so every array and
 * object member is walked rather than `children` alone.
 */
const fillTiles = (value: unknown, app: App): unknown => {
  if (Array.isArray(value)) return value.map((item: unknown) => fillTiles(item, app))
  if (!isNode(value)) return value
  if (isTile(value)) return fillTile(value, app)
  return Object.fromEntries(
    Object.entries(value).map(([key, member]) => [key, fillTiles(member, app)])
  )
}

/** True when some node under `value` reserves a tile, so a page without one is returned as is. */
const hasTile = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasTile)
  if (!isNode(value)) return false
  return isTile(value) || Object.values(value).some(hasTile)
}

/**
 * Fill the page's app-mark tiles with the mark of `app`, the app serving it.
 * A page reserving none is returned by reference.
 */
export function resolvePageAppMark(page: Page, app: App): Page {
  const components = page.components as readonly unknown[] | undefined
  if (components === undefined || !hasTile(components)) return page
  return { ...page, components: fillTiles(components, app) as Page['components'] }
}
