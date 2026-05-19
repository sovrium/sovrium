/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

export type BodyStyle = {
  readonly fontFamily?: string
  readonly fontSize?: string
  readonly lineHeight?: string
  readonly fontStyle?: 'normal' | 'italic' | 'oblique'
  readonly letterSpacing?: string
  readonly textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

function buildFontFamily(family: string, fallback?: string): string {
  return fallback ? `${family}, ${fallback}` : family
}

export function generateBodyStyle(theme: Theme | undefined): BodyStyle | undefined {
  if (!theme?.fonts?.body) return undefined

  const bodyFont = theme.fonts.body

  return {
    ...(bodyFont.family && { fontFamily: buildFontFamily(bodyFont.family, bodyFont.fallback) }),
    ...(bodyFont.size && { fontSize: bodyFont.size }),
    ...(bodyFont.lineHeight && { lineHeight: bodyFont.lineHeight }),
    ...(bodyFont.style && { fontStyle: bodyFont.style as 'normal' | 'italic' | 'oblique' }),
    ...(bodyFont.letterSpacing && { letterSpacing: bodyFont.letterSpacing }),
    ...(bodyFont.transform && {
      textTransform: bodyFont.transform as 'none' | 'uppercase' | 'lowercase' | 'capitalize',
    }),
  }
}
