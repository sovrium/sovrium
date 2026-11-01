/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { resolveFrontmatterReferences } from '@/domain/models/app/pages/frontmatter-reference-service'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { OpenGraph } from '@/domain/models/app/pages/meta'

/** The card values a declared card without its own takes from the page. */
type CardFallbackKey = 'title' | 'description'

/**
 * A DECLARED sharing card without `key` takes the page's resolved `value`; a
 * page that declares no `openGraph` gains no tag, and an empty value fills
 * nothing.
 */
export const withPageValue = (
  page: Page,
  openGraph: OpenGraph | undefined,
  key: CardFallbackKey,
  value: string
): OpenGraph | undefined =>
  openGraph === undefined ||
  page.meta?.openGraph === undefined ||
  openGraph[key] !== undefined ||
  value === ''
    ? openGraph
    : { ...openGraph, [key]: value }

/**
 * What a Twitter card declared without a title or description reads: the
 * sharing card's resolved value — what X reads in its absence — then the
 * page's own.
 */
export const twitterFallbacks = (
  openGraph: OpenGraph | undefined,
  page: { readonly title: string; readonly description: string },
  lang: string,
  languages: Languages | undefined
): { readonly title: string | undefined; readonly description: string | undefined } => {
  const shared = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : resolveTranslationPattern(value, lang, languages)
  return {
    title: shared(openGraph?.title) || page.title || undefined,
    description: shared(openGraph?.description) || page.description || undefined,
  }
}

/** The card values that read a `$frontmatter` reference, as the matching `meta` value does. */
const FRONTMATTER_CARD_KEYS = ['title', 'description', 'imageAlt'] as const

/** `card` with each of its text values' `$frontmatter` references substituted. */
const resolveCardFrontmatter = <
  T extends Partial<Record<(typeof FRONTMATTER_CARD_KEYS)[number], string>>,
>(
  card: T | undefined,
  frontmatter: Readonly<Record<string, string>>
): T | undefined =>
  card === undefined
    ? undefined
    : FRONTMATTER_CARD_KEYS.reduce<T>(
        (resolved, key) =>
          typeof card[key] === 'string'
            ? { ...resolved, [key]: resolveFrontmatterReferences(card[key], frontmatter) }
            : resolved,
        card
      )

/**
 * A markdown page's declared `openGraph` and `twitter` cards with their
 * `$frontmatter` references resolved against the article, before any `$t:`
 * step: a key the article does not declare resolves to nothing, so its tag is
 * left out rather than printing the reference. A page without frontmatter is
 * returned as it is.
 */
export const withFrontmatterCards = (
  page: Page,
  frontmatter: Readonly<Record<string, string>> | undefined
): Page =>
  frontmatter === undefined || page.meta === undefined
    ? page
    : {
        ...page,
        meta: {
          ...page.meta,
          ...(page.meta.openGraph && {
            openGraph: resolveCardFrontmatter(page.meta.openGraph, frontmatter),
          }),
          ...(page.meta.twitter && {
            twitter: resolveCardFrontmatter(page.meta.twitter, frontmatter),
          }),
        },
      }
