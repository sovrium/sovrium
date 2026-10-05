/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'

/**
 * `true` when the page is served below the site root's directory — a `/:lang/`
 * prefix, a mount base, or a path with a directory of its own — so a `./` href
 * would resolve against that directory instead of the root of `public/`.
 */
export function servedBelowRoot(input: {
  readonly path: string
  readonly urlLanguage: string | undefined
  readonly basePath: string | undefined
}): boolean {
  if (input.urlLanguage !== undefined || (input.basePath ?? '') !== '') return true
  return input.path.slice(0, input.path.lastIndexOf('/') + 1) !== '/'
}

const fromPublicRoot = (href: string, basePath: string): string =>
  href.startsWith('./') ? `${basePath}/${href.slice(2)}` : href

/**
 * Read a `./` favicon from the root of `public/`, whatever the page's address.
 *
 * `./favicon.svg` is written relative to the app's `public/` folder, but a
 * browser resolves it against the page it is on: `/fr/favicon.svg` on a French
 * page, which does not exist. A page served below the root therefore names the
 * icon from the root (under the mount base, when there is one). A page at the
 * root keeps the path as written, so a static build stays portable to a host
 * that serves it from a sub-directory.
 */
type PageFavicons = NonNullable<NonNullable<Page['meta']>['favicons']>

/** Both favicon forms — the explicit set and the named object — rebased. */
const rebaseFavicons = (favicons: PageFavicons, basePath: string): PageFavicons => {
  const rebase = (href: string): string => fromPublicRoot(href, basePath)
  if (Array.isArray(favicons)) {
    return favicons.map((icon) => ({ ...icon, href: rebase(icon.href) }))
  }
  const named = favicons as Exclude<PageFavicons, readonly unknown[]>
  return {
    ...named,
    ...(named.icon !== undefined ? { icon: rebase(named.icon) } : {}),
    ...(named.appleTouchIcon !== undefined ? { appleTouchIcon: rebase(named.appleTouchIcon) } : {}),
    ...(named.sizes !== undefined
      ? { sizes: named.sizes.map((size) => ({ ...size, href: rebase(size.href) })) }
      : {}),
  }
}

export function rootRelativeFavicons(page: Page, basePath: string, nested: boolean): Page {
  const { meta } = page
  if (!nested || meta === undefined) return page
  const favicons = meta.favicons === undefined ? undefined : rebaseFavicons(meta.favicons, basePath)
  return {
    ...page,
    meta: {
      ...meta,
      ...(meta.favicon !== undefined ? { favicon: fromPublicRoot(meta.favicon, basePath) } : {}),
      ...(favicons !== undefined ? { favicons } : {}),
    },
  }
}
