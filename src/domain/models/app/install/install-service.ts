/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '../app'

/** One entry of the home page's favicon set, as the manifest reads it. */
export interface HomeIcon {
  readonly rel: string
  readonly href: string
  readonly sizes?: string
  readonly type?: string
}

/** One icon of the manifest: where it is, and the sizes and type it declares. */
export interface ManifestIcon {
  readonly src: string
  readonly sizes: string
  readonly type?: string
}

/** The web app manifest `/manifest.webmanifest` answers. */
export interface WebAppManifest {
  readonly name: string
  readonly short_name: string
  readonly description?: string
  readonly display: 'standalone' | 'minimal-ui' | 'browser'
  readonly start_url: '/'
  readonly scope: '/'
  readonly icons: readonly ManifestIcon[]
  readonly theme_color?: string
}

/** The two raster sizes a manifest lists for a home screen and a splash screen. */
const MANIFEST_SIZES = new Set(['192x192', '512x512'])

/** A synthetic base, used only to resolve a relative favicon address against the site root. */
const SITE_ROOT = 'https://sovrium.invalid/'

/** `href` as the manifest names it: a relative one on the site root, an address in full kept. */
const iconAddress = (href: string): string => {
  const resolved = new URL(href, SITE_ROOT)
  return resolved.origin === new URL(SITE_ROOT).origin
    ? `${resolved.pathname}${resolved.search}`
    : resolved.href
}

/**
 * The icons of the home page's favicon set a manifest lists: the 192 and 512
 * pixel entries, and an SVG icon, which scales to both — in declared order.
 */
const manifestIcons = (homeIcons: readonly HomeIcon[]): readonly ManifestIcon[] =>
  homeIcons
    .filter((icon) => icon.rel === 'icon' || icon.rel === 'apple-touch-icon')
    .filter(
      (icon) =>
        (icon.sizes !== undefined && MANIFEST_SIZES.has(icon.sizes)) ||
        icon.type === 'image/svg+xml'
    )
    .map((icon) => ({
      src: iconAddress(icon.href),
      sizes: icon.sizes ?? 'any',
      ...(icon.type === undefined ? {} : { type: icon.type }),
    }))

/**
 * The engine's neutral default icon, as a manifest lists it: the 32 pixel ICO
 * the server answers at `/favicon.ico` for an app that declares no favicon.
 */
export const DEFAULT_MANIFEST_ICON: ManifestIcon = {
  src: '/favicon.ico',
  sizes: '32x32',
  type: 'image/x-icon',
}

/** Whether any page of the app names its own icon, in either favicon form. */
export const declaresFavicon = (app: Pick<App, 'pages'>): boolean =>
  (app.pages ?? []).some(
    (page) => page.meta?.favicon !== undefined || page.meta?.favicons !== undefined
  )

/**
 * The web app manifest of an app that declares `install`, built from the app
 * itself so it cannot drift from it — `homeIcons` is its home page's favicon
 * set — and `undefined` for an app that does not.
 * The name is `displayName`, else `name`; the theme colour the design's
 * `primary` colour, when it declares one. An app that declares no favicon on
 * any page lists the engine's neutral default icon, so the manifest never
 * names an empty icon list the engine could have filled.
 */
export const buildWebAppManifest = (
  app: Pick<App, 'name' | 'displayName' | 'description' | 'install' | 'design' | 'pages'>,
  homeIcons: readonly HomeIcon[]
): WebAppManifest | undefined => {
  const { install } = app
  if (install === undefined) return undefined
  const name = app.displayName ?? app.name
  const primary = app.design?.colors?.['primary']
  return {
    name,
    short_name: install.shortName ?? name,
    ...(app.description === undefined ? {} : { description: app.description }),
    display: install.display ?? 'standalone',
    start_url: '/',
    scope: '/',
    icons: declaresFavicon(app) ? manifestIcons(homeIcons) : [DEFAULT_MANIFEST_ICON],
    ...(typeof primary === 'string' ? { theme_color: primary } : {}),
  }
}
