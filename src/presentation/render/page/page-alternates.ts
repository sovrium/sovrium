/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'
import { languageAlternates } from '@/domain/kernel/matching/localized-alternates'
import { appRoutePatterns, type PageAddress } from '@/domain/kernel/matching/localized-path'
import { findDeclaredLanguageCode } from '@/domain/models/app/languages/language-detection'
import { findRssPage, resolveRssChannelIdentity } from '@/domain/models/app/pages/rss-feed-builder'
import type { App } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

/**
 * What a document's head announces as its alternates, computed once per
 * document from the app: the page in its other languages, and the feed it
 * publishes.
 */

/**
 * The address of the page being rendered in every language it exists in —
 * what its `hreflang` alternates and its language switcher both name.
 *
 * A context rather than a prop because the two readers sit far apart (the
 * head's alternates, a switcher anywhere in the body) and neither otherwise
 * knows the app's other pages, which is what deciding whether a twin exists
 * needs. Provided once per document by `renderPageHtml`; empty outside a page
 * request.
 */
export const PageLanguageAlternatesContext = createContext<ReadonlyArray<PageAddress>>([])

/** What a document's alternates are read from: its address, and its record's when it has one. */
export interface PageAlternatesRequest {
  /** The path the page was matched for, dynamic segments filled: what its alternates describe. */
  readonly renderedPath?: string
  /**
   * The record's address in each language it has a slug in, for a collection
   * page naming a slug field per language (`recordLanguageAddresses`). When
   * given, these ARE the alternates — the sitemap pairs the same ones — even
   * when only one language has a slug: the page then names itself alone.
   */
  readonly languageAddresses?: ReadonlyArray<PageAddress> | undefined
}

/**
 * The alternates of `page` rendered at `renderedPath`, computed by the domain's
 * one reading of page paths so the HTML pairs exactly what the sitemap pairs.
 */
export const pageLanguageAlternatesFor = (
  app: App,
  page: Page,
  { renderedPath, languageAddresses }: PageAlternatesRequest
): ReadonlyArray<PageAddress> => {
  const languages = app.languages?.supported.map((language) => language.code) ?? []
  if (renderedPath === undefined || languages.length < 2) return []
  if (languageAddresses !== undefined) return languageAddresses
  return languageAlternates({
    path: page.path,
    address: renderedPath,
    routes: appRoutePatterns(app.pages ?? []),
    languages,
  })
}

/**
 * The feed title a page announces in its head, or `undefined` when the page
 * is not the one `/feed.xml` is built from. Only that page links the feed, so
 * the autodiscovery link never points a reader at a feed of another page.
 */
export const resolveFeedTitle = (app: App, page: Page): string | undefined => {
  const rssPage = findRssPage(app)
  return rssPage !== undefined && rssPage.name === page.name
    ? resolveRssChannelIdentity(app, rssPage).title
    : undefined
}

/**
 * The canonical a page that declares none takes in a multi-language app: its
 * own address in the language it is read in, on `BASE_URL` (`SOVRIUM_BASE_URL`
 * during `sovrium build`). Without it, a language-agnostic page served at
 * `/en/about` and `/fr/about` carries no canonical at all, and a fixed one
 * would declare every other language a duplicate of the language it names.
 *
 * `undefined` when the page exists in a single language (no alternates) or no
 * public origin is declared: a relative canonical is worse than none.
 */
export const selfCanonicalFor = (
  alternates: ReadonlyArray<PageAddress>,
  lang: string,
  languages: Languages | undefined
): string | undefined => {
  const origin = (Bun.env.BASE_URL || Bun.env.SOVRIUM_BASE_URL)?.replace(/\/$/, '')
  const code = findDeclaredLanguageCode(languages, lang)
  const own = alternates.find((alternate) => alternate.language === code)
  return origin === undefined || origin === '' || own === undefined
    ? undefined
    : `${origin}${own.path}`
}
