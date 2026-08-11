/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
 * Resolves the active language for a page.
 *
 * Priority: `urlLanguage` > `page.meta.lang` > `detectedLanguage` > `languages.default` > `'en-US'`.
 *
 * The `/:lang/` URL prefix sits ABOVE `page.meta.lang` ([internal ref]..039).
 * A locale a visitor asked for by URL is an explicit request and must win: with
 * `meta.lang` on top, a page that declared one became locale-frozen and `/fr/`
 * served English under `lang="en"` while the sitemap advertised it as
 * `hreflang="fr-FR"`. The override runs in BOTH directions — `/en/` over a page
 * pinned `fr` renders English.
 *
 * `page.meta.lang` stays above browser detection: it remains the right answer
 * for a page reached WITHOUT a language prefix, so it is demoted, not removed.
 *
 * @param page - Page configuration
 * @param languages - Languages configuration
 * @param detectedLanguage - Request-resolved language (URL prefix, else Accept-Language)
 * @param urlLanguage - The `/:lang/` URL-prefix locale, when the request carried one
 * @returns Language configuration with direction and styles
 */
export function resolvePageLanguage(
  page: Page,
  languages: Languages | undefined,
  detectedLanguage: string | undefined,
  urlLanguage?: string
): PageLangConfig {
  const lang = urlLanguage ?? page.meta?.lang ?? detectedLanguage ?? languages?.default ?? 'en-US'

  // Determine text direction from language configuration
  // Match by code (en) or locale (en-US)
  const langConfig = languages?.supported.find((l) => l.code === lang || l.locale === lang)
  const direction = langConfig?.direction || 'ltr'

  // Generate CSS for body direction to ensure RTL/LTR is applied as CSS property
  const directionStyles = `
    html[lang="${lang}"] { direction: ${direction}; }
    html[lang="${lang}"] body { direction: ${direction}; }
  `

  return { lang, direction, directionStyles }
}
