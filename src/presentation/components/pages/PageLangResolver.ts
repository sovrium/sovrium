/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

/**
 * Page language configuration
 */
export type PageLangConfig = {
  readonly lang: string
  readonly direction: 'ltr' | 'rtl'
  readonly directionStyles: string
}

/**
 * Resolves language configuration for a page
 *
 * Priority: page.meta.lang > detectedLanguage > languages.default > 'en-US'
 *
 * @param page - Page configuration
 * @param languages - Languages configuration
 * @param detectedLanguage - Detected language from browser/URL
 * @returns Language configuration with direction and styles
 */
export function resolvePageLanguage(
  page: Page,
  languages: Languages | undefined,
  detectedLanguage: string | undefined
): PageLangConfig {
  // Priority: page.meta.lang (EXPLICIT) > detectedLanguage > languages.default > fallback
  // NOTE: Using explicit check to ensure page.meta.lang is always preferred when present
  const lang =
    page.meta && page.meta.lang
      ? page.meta.lang
      : detectedLanguage
        ? detectedLanguage
        : languages?.default
          ? languages.default
          : 'en-US'

  // Determine text direction from language configuration
  // Match by code (en) or locale (en-US)
  const langConfig = languages?.supported.find(
    (l) => l.code === lang || l.locale === lang
  )
  const direction = langConfig?.direction || 'ltr'

  // Generate CSS for body direction to ensure RTL/LTR is applied as CSS property
  const directionStyles = `
    html[lang="${lang}"] { direction: ${direction}; }
    html[lang="${lang}"] body { direction: ${direction}; }
  `

  return { lang, direction, directionStyles }
}
