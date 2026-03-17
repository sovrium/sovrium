/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { Meta } from '@/domain/models/app/page/meta'
import type { Page } from '@/domain/models/app/pages'

/**
 * Resolves i18n metadata for a single language
 */
function resolveMetaI18n(
  meta: Meta,
  langCode: string,
  languages: Languages
): { title?: string; description?: string; keywords?: string; 'og:site_name'?: string } {
  const metaRecord = meta as Record<string, unknown>
  const ogSiteName = metaRecord['og:site_name']

  return {
    ...(meta.title && {
      title: resolveTranslationPattern(meta.title, langCode, languages),
    }),
    ...(meta.description && {
      description: resolveTranslationPattern(meta.description, langCode, languages),
    }),
    ...(meta.keywords && {
      keywords: resolveTranslationPattern(meta.keywords, langCode, languages),
    }),
    ...(typeof ogSiteName === 'string' && {
      'og:site_name': resolveTranslationPattern(ogSiteName, langCode, languages),
    }),
    ...(meta.openGraph?.siteName &&
      typeof ogSiteName !== 'string' && {
        'og:site_name': resolveTranslationPattern(meta.openGraph.siteName, langCode, languages),
      }),
  }
}

/**
 * Merges existing i18n with generated i18n
 */
function mergeI18n(
  generatedI18n: Record<
    string,
    { title?: string; description?: string; keywords?: string; 'og:site_name'?: string }
  >,
  existingI18n:
    | Record<
        string,
        { title?: string; description?: string; keywords?: string; 'og:site_name'?: string }
      >
    | undefined
): typeof generatedI18n {
  if (!existingI18n) {
    return generatedI18n
  }

  return Object.keys(generatedI18n).reduce(
    (acc, langCode) => ({
      ...acc,
      [langCode]: {
        ...generatedI18n[langCode],
        ...(existingI18n[langCode] || {}),
      },
    }),
    {} as typeof generatedI18n
  )
}

/**
 * Resolves base meta fields with translation patterns
 */
function resolveBaseMeta(meta: Meta, currentLang: string, languages: Languages): Meta {
  const metaRecord = meta as Record<string, unknown>
  const ogSiteName = metaRecord['og:site_name']

  const resolvedMeta = {
    ...meta,
    ...(meta.title && { title: resolveTranslationPattern(meta.title, currentLang, languages) }),
    ...(meta.description && {
      description: resolveTranslationPattern(meta.description, currentLang, languages),
    }),
    ...(meta.keywords && {
      keywords: resolveTranslationPattern(meta.keywords, currentLang, languages),
    }),
  }

  // Resolve og:site_name if present (either as direct property or in openGraph object)
  if (typeof ogSiteName === 'string') {
    return {
      ...resolvedMeta,
      'og:site_name': resolveTranslationPattern(ogSiteName, currentLang, languages),
    } as Meta
  }

  if (meta.openGraph?.siteName) {
    return {
      ...resolvedMeta,
      openGraph: {
        ...meta.openGraph,
        siteName: resolveTranslationPattern(meta.openGraph.siteName, currentLang, languages),
      },
    }
  }

  return resolvedMeta
}

/**
 * Builds i18n metadata structure for client-side language switching
 *
 * Resolves translation patterns ($t:...) for all supported languages
 * and constructs a complete i18n structure that the client can use
 * to update meta tags when switching languages.
 *
 * CRITICAL: All $t: tokens in base meta fields are resolved to ensure
 * no translation tokens appear in the serialized HTML output.
 *
 * @param page - Page configuration
 * @param languages - Languages configuration
 * @returns Page meta with i18n structure populated and all $t: tokens resolved
 */
export function buildPageMetadataI18n(
  page: Page,
  languages: Languages | undefined
): Meta | Record<string, never> {
  if (!page.meta || !languages) {
    return (page.meta || {}) as Meta | Record<string, never>
  }

  const { meta } = page
  const currentLang = meta.lang || languages.default

  // Build i18n structure for all supported languages
  const generatedI18n = languages.supported.reduce(
    (acc, lang) => ({
      ...acc,
      [lang.code]: resolveMetaI18n(meta, lang.code, languages),
    }),
    {} as Record<
      string,
      { title?: string; description?: string; keywords?: string; 'og:site_name'?: string }
    >
  )

  // Merge existing meta.i18n with generated i18n (existing takes precedence)
  const existingI18n = (meta as Record<string, unknown>).i18n as
    | Record<
        string,
        { title?: string; description?: string; keywords?: string; 'og:site_name'?: string }
      >
    | undefined

  const i18n = mergeI18n(generatedI18n, existingI18n)

  // Resolve all $t: tokens in base meta fields for current language
  const resolvedMeta = resolveBaseMeta(meta, currentLang, languages)

  // Return resolved meta with i18n structure
  return {
    ...resolvedMeta,
    i18n,
  }
}
