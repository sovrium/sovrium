/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildCustomElement } from './custom-elements-builders'
import type { CustomElements } from '@/domain/models/app/page/meta/custom-elements'
import type { FaviconSet } from '@/domain/models/app/page/meta/favicon-set'
import type { Preload } from '@/domain/models/app/page/meta/preload'

/**
 * Render DNS prefetch link tags
 * Generates <link rel="dns-prefetch" href="..."> tags for external domains
 *
 * @param dnsPrefetch - DNS prefetch configuration from page.meta
 * @returns React fragment with DNS prefetch link tags
 */
export function DnsPrefetchLinks({
  dnsPrefetch,
}: {
  readonly dnsPrefetch?: ReadonlyArray<string>
}): Readonly<ReactElement | undefined> {
  if (!dnsPrefetch || dnsPrefetch.length === 0) {
    return undefined
  }

  return (
    <>
      {dnsPrefetch.map((domain) => (
        <link
          key={domain}
          rel="dns-prefetch"
          href={domain}
        />
      ))}
    </>
  )
}

/**
 * Render custom head elements
 * Generates arbitrary HTML elements (meta, link, script, style, base) in <head>
 *
 * @param customElements - Custom elements configuration from page.meta
 * @returns React fragment with custom head elements
 */
export function CustomElementsHead({
  customElements,
}: {
  readonly customElements?: CustomElements
}): Readonly<ReactElement | undefined> {
  if (!customElements || customElements.length === 0) {
    return undefined
  }

  return <>{customElements.map(buildCustomElement)}</>
}

/**
 * Render single favicon link tag
 * Generates simple <link rel="icon" href="..."> tag for default favicon
 *
 * @param favicon - Favicon path from page.meta.favicon
 * @returns React element with favicon link tag or undefined
 */
export function FaviconLink({
  favicon,
}: {
  readonly favicon?: string
}): Readonly<ReactElement | undefined> {
  if (!favicon) {
    return undefined
  }

  return (
    <link
      rel="icon"
      href={favicon}
    />
  )
}

/**
 * Render favicon set link tags
 * Generates <link rel="..."> tags for multi-device favicon support
 *
 * Supports:
 * - icon: Standard browser favicon (16x16, 32x32)
 * - apple-touch-icon: iOS home screen icon (180x180)
 * - manifest: PWA manifest file reference
 * - mask-icon: Safari pinned tab icon (monochrome SVG with color)
 *
 * @param favicons - Favicon set configuration from page.meta
 * @returns React fragment with favicon link tags
 */
export function FaviconSetLinks({
  favicons,
}: {
  readonly favicons?: FaviconSet
}): Readonly<ReactElement | undefined> {
  if (!favicons || favicons.length === 0) {
    return undefined
  }

  return (
    <>
      {favicons.map((favicon, index) => {
        // Convert relative path (./favicon.png) to absolute path (/favicon.png)
        // Remove the leading ./ to make it an absolute path from the root
        const href = favicon.href.replace(/^\.\//, '/')

        return (
          <link
            key={index}
            rel={favicon.rel}
            href={href}
            {...(favicon.type && { type: favicon.type })}
            {...(favicon.sizes && { sizes: favicon.sizes })}
            {...(favicon.color && { color: favicon.color })}
          />
        )
      })}
    </>
  )
}

/**
 * Render preload link tags
 * Generates <link rel="preload" ...> tags for critical resources
 *
 * @param preload - Preload configuration from page.meta
 * @returns React fragment with preload link tags
 */
export function PreloadLinks({
  preload,
}: {
  readonly preload?: Preload
}): Readonly<ReactElement | undefined> {
  if (!preload || preload.length === 0) {
    return undefined
  }

  return (
    <>
      {preload.map((item, index) => (
        <link
          key={index}
          rel="preload"
          href={item.href}
          as={item.as}
          {...(item.type && { type: item.type })}
          {...(item.crossorigin !== undefined &&
            (typeof item.crossorigin === 'boolean'
              ? item.crossorigin && { crossOrigin: '' }
              : { crossOrigin: item.crossorigin }))}
          {...(item.media && { media: item.media })}
        />
      ))}
    </>
  )
}
