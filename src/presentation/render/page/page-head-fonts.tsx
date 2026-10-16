/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { GEIST_SANS_FONT_FILE, webFontHref } from '@/infrastructure/css/theme/fonts/web-font-files'
import type { Design } from '@/domain/models/app/design'

/**
 * Whether the page's body text resolves to the self-hosted Geist face, i.e. the
 * design names neither a `sans` nor a `body` family of its own.
 *
 * A design that replaces it would never draw with Geist, and a preload of a
 * face nobody uses costs its bytes on every first visit (and a console warning
 * in every browser), which is exactly what serving the font as a file set out
 * to save.
 */
const drawsWithSelfHostedSans = (design: Design | undefined): boolean =>
  design?.typeScale?.families?.sans === undefined && design?.typeScale?.families?.body === undefined

/**
 * Preload the self-hosted sans face, so its request starts with the
 * stylesheet's rather than after the stylesheet is parsed and text is laid
 * out. The sans face only: mono is drawn by code and keyboard hints, which many
 * pages never show, and an `@font-face` that no text uses is never fetched.
 *
 * `crossOrigin` is required even though the file is same-origin: a font is
 * always fetched in CORS mode, and a preload made without it is a different
 * request the browser cannot reuse.
 */
export function SansFontPreload({
  design,
}: {
  readonly design: Design | undefined
}): ReactElement | undefined {
  if (!drawsWithSelfHostedSans(design)) return undefined
  return (
    <link
      rel="preload"
      href={webFontHref(GEIST_SANS_FONT_FILE)}
      as="font"
      type="font/woff2"
      crossOrigin="anonymous"
    />
  )
}

/**
 * Renders font stylesheets from design configuration
 */
export function ThemeFonts({
  design,
}: {
  readonly design: Design | undefined
}): ReactElement | undefined {
  if (!design?.typeScale?.families) return undefined

  return (
    <>
      {Object.values(design.typeScale?.families).map((font, index) =>
        font.url ? (
          <link
            key={`font-${index}`}
            rel="stylesheet"
            href={font.url}
          />
        ) : undefined
      )}
    </>
  )
}

/**
 * Renders Google Fonts with performance optimizations
 * Includes preconnect hints for fonts.googleapis.com and fonts.gstatic.com
 */
export function GoogleFonts({
  googleFonts,
}: {
  readonly googleFonts: string | undefined
}): ReactElement | undefined {
  if (!googleFonts) return undefined

  return (
    <>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href={googleFonts}
      />
    </>
  )
}
