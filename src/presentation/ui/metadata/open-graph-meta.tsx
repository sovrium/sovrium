/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
import { renderMetaTags } from './meta-utils'
import type { Languages } from '@/domain/models/app/languages'
import type { OpenGraph } from '@/domain/models/app/page/meta/open-graph'

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

  return renderMetaTags({ fields, prefix: 'og', attributeType: 'property' })
}
