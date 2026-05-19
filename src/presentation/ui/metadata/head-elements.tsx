/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildCustomElement } from './custom-elements-builders'
import type { CustomElements, FaviconSet, Preload } from '@/domain/models/app/pages/meta'

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
