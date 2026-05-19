/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

export type PageLangConfig = {
  readonly lang: string
  readonly direction: 'ltr' | 'rtl'
  readonly directionStyles: string
}

export function resolvePageLanguage(
  page: Page,
  languages: Languages | undefined,
  detectedLanguage: string | undefined
): PageLangConfig {
  const lang =
    page.meta && page.meta.lang
      ? page.meta.lang
      : detectedLanguage
        ? detectedLanguage
        : languages?.default
          ? languages.default
          : 'en-US'

  const langConfig = languages?.supported.find((l) => l.code === lang || l.locale === lang)
  const direction = langConfig?.direction || 'ltr'

  const directionStyles = `
    html[lang="${lang}"] { direction: ${direction}; }
    html[lang="${lang}"] body { direction: ${direction}; }
  `

  return { lang, direction, directionStyles }
}
