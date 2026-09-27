/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { renderMetaTags } from './meta-utils'
import type { Languages } from '@/domain/models/app/languages'
import type { OpenGraph } from '@/domain/models/app/pages/meta'

/**
 * Render Open Graph metadata tags
 * Generates <meta property="og:*"> tags for Facebook/LinkedIn sharing
 *
 * @param openGraph - Open Graph configuration from page.meta
 * @param lang - Current language code for translation resolution
 * @param languages - Languages configuration for translation resolution
 * @returns React fragment with OG meta tags
 */
export function OpenGraphMeta({
  openGraph,
  lang,
  languages,
}: {
  readonly openGraph?: OpenGraph
  readonly lang?: string
  readonly languages?: Languages
}): Readonly<ReactElement | undefined> {
  if (!openGraph) {
    return undefined
  }

  // Resolve translation patterns in OpenGraph fields
  const resolveValue = (value: string | undefined): string | undefined => {
    if (!value || !lang) return value
    return resolveTranslationPattern(value, lang, languages)
  }

  const fields: ReadonlyArray<{ readonly key: string; readonly value?: string }> = [
    { key: 'title', value: resolveValue(openGraph.title) },
    { key: 'description', value: resolveValue(openGraph.description) },
    { key: 'image', value: openGraph.image },
    { key: 'image:alt', value: resolveValue(openGraph.imageAlt) },
    { key: 'url', value: openGraph.url },
    { key: 'type', value: openGraph.type },
    { key: 'site_name', value: resolveValue(openGraph.siteName) },
    { key: 'locale', value: openGraph.locale },
    { key: 'determiner', value: openGraph.determiner },
    { key: 'video', value: openGraph.video },
    { key: 'audio', value: openGraph.audio },
  ]

  const alternates = resolveLocaleAlternates(languages, lang, openGraph.locale)
  return (
    <>
      {renderMetaTags({ fields, prefix: 'og', attributeType: 'property' })}
      {alternates.map((locale) => (
        <meta
          key={`locale:alternate:${locale}`}
          property="og:locale:alternate"
          content={locale}
        />
      ))}
    </>
  )
}

/** `fr-FR` → `fr_FR`, or `undefined` when the tag carries no territory. */
const toOpenGraphLocale = (tag: string | undefined): string | undefined => {
  const match = tag === undefined ? undefined : /^([a-z]{2})[-_]([A-Z]{2})$/.exec(tag)
  return match === null || match === undefined ? undefined : `${match[1]}_${match[2]}`
}

/**
 * The `og:locale:alternate` values of a page in a multi-language app: every
 * OTHER declared language, in the `language_TERRITORY` form Open Graph uses,
 * so a platform can serve the share in the reader's language. The page's own
 * language — the one it renders in, or its explicit `openGraph.locale` — is
 * never repeated, and a language declared without a territory has no Open
 * Graph form and is left out.
 */
const resolveLocaleAlternates = (
  languages: Languages | undefined,
  lang: string | undefined,
  ownLocale: string | undefined
): readonly string[] => {
  if (languages === undefined || languages.supported.length <= 1) return []
  const own = new Set([ownLocale, toOpenGraphLocale(lang)])
  return languages.supported
    .filter((language) => language.code !== lang && language.locale !== lang)
    .map((language) => toOpenGraphLocale(language.locale ?? language.code))
    .filter((locale): locale is string => locale !== undefined && !own.has(locale))
}
