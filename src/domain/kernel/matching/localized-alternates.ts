/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page's address in its other languages, read off the one reading of page
 * paths in `./localized-path`: the alternates the HTML head, the sitemap and
 * the language switcher name, and the redirect a translated slug requested
 * under the wrong language answers with.
 */

import {
  declaresLanguageSegment,
  findPageRoute,
  isLocalizedPagePath,
  leadingLanguageOf,
  localizedPageAddresses,
  withLanguagePrefix,
  withLanguageSegment,
  type DeclaredPagePath,
  type LocalizedPagePath,
  type PageAddress,
} from './localized-path'
import { fillRoutePattern, findMatchingRoute, matchRoute } from './route-matcher'

/** The dynamic segments of `pattern`, in order: each name, and whether it is a wildcard. */
const dynamicSegments = (
  pattern: string
): ReadonlyArray<{ readonly name: string; readonly wildcard: boolean }> =>
  pattern
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => ({
      name: segment.slice(1).replace(/\*$/, ''),
      wildcard: segment.endsWith('*'),
    }))

/**
 * The dynamic-segment values of `address` read against `pattern`, by position —
 * decoded, as {@link matchRoute} captures them; `undefined` for one it did not
 * capture.
 */
const positionalValues = (
  pattern: string,
  address: string
): ReadonlyArray<string | undefined> | undefined => {
  const match = matchRoute(pattern, address)
  if (!match.matched) return undefined
  return dynamicSegments(pattern).map(({ name }) => match.params[name])
}

/**
 * `pattern` with its dynamic segments filled, in order, from `values`, each
 * value percent-encoded again. A captured value is decoded, so writing it back
 * as is would let it change the address's shape: `%2F` would split a segment,
 * `%3F` start a query, and `%5C` lead a browser to read `/\host` as another
 * site. A wildcard keeps its `/` separators and encodes each segment. A value
 * not captured leaves its segment as written.
 */
const fillByPosition = (pattern: string, values: ReadonlyArray<string | undefined>): string => {
  const params = Object.fromEntries(
    dynamicSegments(pattern).flatMap(({ name, wildcard }, position) => {
      const value = values[position]
      if (value === undefined) return []
      const encoded = wildcard
        ? value.split('/').map(encodeURIComponent).join('/')
        : encodeURIComponent(value)
      return [[name, encoded] as const]
    })
  )
  return fillRoutePattern(pattern, params)
}

/** The alternates of a per-language page served at `address`. */
const localizedAlternates = (
  path: LocalizedPagePath,
  address: string
): ReadonlyArray<PageAddress> => {
  const addresses = localizedPageAddresses(path)
  const values =
    addresses
      .map((entry) => positionalValues(entry.path, address))
      .find((found) => found !== undefined) ?? []
  return addresses.map((entry) => ({
    language: entry.language,
    path: fillByPosition(entry.path, values),
  }))
}

/**
 * The alternates of a page whose path names its language (`/fr/pricing`): the
 * same path under each other language, kept only where some page answers it.
 * An address no page serves is a 404, and an alternate pointing at one tells
 * search engines the page has a twin it does not have.
 */
const namedLanguageAlternates = (
  address: string,
  own: string,
  routes: ReadonlyArray<string>,
  languages: ReadonlyArray<string>
): ReadonlyArray<PageAddress> =>
  languages.flatMap((language) => {
    const twin = address.replace(/^\/[^/]+/, `/${language}`)
    return language === own || findMatchingRoute(routes, twin) !== undefined
      ? [{ language, path: twin }]
      : []
  })

/** What {@link languageAlternates} reads. */
export interface LanguageAlternatesInput {
  /** The page's declared path. */
  readonly path: DeclaredPagePath
  /**
   * The address being described, dynamic segments filled: the path the page
   * was rendered for, or a sitemap entry's concrete path.
   */
  readonly address: string
  /** Every route pattern the app declares ({@link pageRoutePatterns} of every page). */
  readonly routes: ReadonlyArray<string>
  /** The declared language codes, in order. */
  readonly languages: ReadonlyArray<string>
}

/**
 * The page's address in every language it exists in, in language order, or
 * none when it exists in fewer than two — a single language has no alternate.
 *
 *  - a per-language path: each language's own address, carrying the dynamic
 *    values `address` captured;
 *  - a plain path naming its language (`/fr/pricing`): itself, and the same
 *    path under each other language where a page answers it;
 *  - a plain path naming none (`/about`): the path under every language.
 */
export const languageAlternates = ({
  path,
  address,
  routes,
  languages,
}: LanguageAlternatesInput): ReadonlyArray<PageAddress> => {
  if (languages.length < 2) return []
  const own = leadingLanguageOf(address, languages)
  const alternates = isLocalizedPagePath(path)
    ? localizedAlternates(path, address).filter((entry) => languages.includes(entry.language))
    : own !== undefined
      ? namedLanguageAlternates(address, own, routes, languages)
      : languages.map((language) => ({
          language,
          // Only a declared `:lang` is substituted: `address` may be the request's own text.
          path: declaresLanguageSegment(path)
            ? withLanguagePrefix(language, address)
            : withLanguageSegment(language, address),
        }))
  const ordered = languages.flatMap((language) =>
    alternates.filter((entry) => entry.language === language)
  )
  return ordered.length < 2 ? [] : ordered
}

/**
 * Where a translated slug requested under the wrong language answers: the
 * same page's own address in the requested language. `/fr/manifesto`, when
 * `/en/manifesto` is a page whose French path is `/manifeste`, gives
 * `/fr/manifeste`; a captured dynamic value travels across (`/fr/blog/x` →
 * `/fr/articles/x`).
 *
 * Only a page declaring a path per language has a slug to correct: a plain
 * path is answered exactly as before. `undefined` when no other language's
 * address of such a page matches, or when that page declares no address in
 * the requested language — a language the map omits has no address.
 */
export const translatedSlugTarget = <P extends { readonly path: DeclaredPagePath }>(
  pages: ReadonlyArray<P>,
  path: string,
  languages: ReadonlyArray<string>
): { readonly page: P; readonly path: string } | undefined => {
  const own = leadingLanguageOf(path, languages)
  if (own === undefined) return undefined
  const remainder = path.slice(own.length + 1) || '/'
  return languages
    .filter((language) => language !== own)
    .map((language) => {
      const address = withLanguageSegment(language, remainder)
      const match = findPageRoute(pages, address)
      if (match?.language === undefined || !isLocalizedPagePath(match.page.path)) return undefined
      const target = localizedAlternates(match.page.path, address).find(
        (alternate) => alternate.language === own
      )
      return target === undefined ? undefined : { page: match.page, path: target.path }
    })
    .find((found) => found !== undefined)
}
