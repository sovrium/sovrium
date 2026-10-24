/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one reading of a page's `path` every caller goes through — in the kernel
 * because the validators of several features (links, forms, redirects) read it
 * beside the pages feature itself.
 *
 * A `path` is either one string — served under every language prefix, or, when
 * it starts with a language code (`/fr/pricing`), that language's page only —
 * or a map of one path per language (`{ en: /manifesto, fr: /manifeste }`),
 * each value served under its own `/{lang}` prefix. Callers never branch on the
 * shape themselves; they take the narrowest helper below:
 *
 *  - {@link primaryPagePath} — one string standing for the page, for identity,
 *    labels and sorting. A plain path is returned unchanged, so a reader that
 *    only needs identity keeps today's behaviour exactly;
 *  - {@link pageRoutePatterns} — the route patterns the page answers to;
 *  - {@link findPageRoute} — which page answers a request path, and in which
 *    language when its path is per-language;
 *  - `languageAlternates` (`./localized-alternates`) — the page's address in
 *    every language it exists in, the pairs the HTML alternates, the sitemap
 *    and the language switcher all read, so they can never disagree.
 */

import { findMatchingRoute, type RouteParams } from './route-matcher'

/** A page path as declared: one string, or one path per language code. */
export type DeclaredPagePath = string | Readonly<Record<string, string>>

/** A path per language code (translated slugs), each value written without its prefix. */
export type LocalizedPagePath = Readonly<Record<string, string>>

/** One address of a page, with the language it is served in. */
export interface PageAddress {
  readonly language: string
  readonly path: string
}

/** Whether `path` declares a path per language rather than one string. */
export const isLocalizedPagePath = (path: DeclaredPagePath): path is LocalizedPagePath =>
  typeof path !== 'string'

/** A `:lang` segment of a route pattern. */
const LANG_SEGMENT = /(^|\/):lang(\/|$)/

/** Whether a route pattern carries a `:lang` segment, substituted rather than prefixed. */
export const declaresLanguageSegment = (path: string): boolean => LANG_SEGMENT.test(path)

/**
 * A concrete `path` under the `/{language}` prefix, nothing substituted: the
 * root path gives the language root `/{language}/`, the one address that keeps
 * its trailing slash. The form for an address a request carries, whose text is
 * the visitor's — a literal `:lang` in it is not a pattern segment, and
 * substituting it could move the language segment out of the lead.
 */
export const withLanguageSegment = (language: string, path: string): string =>
  path === '/' ? `/${language}/` : `/${language}${path}`

/**
 * A route pattern served under the `/{language}` prefix, as
 * {@link withLanguageSegment} gives it, except that a `:lang` segment is
 * substituted rather than prefixed, so a path never carries two language
 * segments. For paths from config only; a request's path takes
 * {@link withLanguageSegment}.
 */
export const withLanguagePrefix = (language: string, path: string): string =>
  LANG_SEGMENT.test(path)
    ? path.replace(LANG_SEGMENT, (_match, pre: string, post: string) =>
        post === '' ? `${pre}${language}` : `${pre}${language}/`
      )
    : withLanguageSegment(language, path)

/**
 * The first segment of `path` when it is one of `languages`, else `undefined`:
 * `/fr/pricing` → `fr`, `/about` → `undefined`.
 */
export const leadingLanguageOf = (
  path: string,
  languages: ReadonlyArray<string>
): string | undefined => {
  const first = path.split('/').find((segment) => segment.length > 0)
  return first !== undefined && languages.includes(first) ? first : undefined
}

/**
 * The addresses `language` serves out of `paths` (route patterns, as
 * {@link pageRoutePatterns} gives them): a path naming no language under that
 * language's prefix, a path naming `language` itself as written, and a path
 * naming another language not at all. What a static build's pass for one
 * language writes, so each page lands once, at its own address, and no address
 * carries two language segments.
 */
export const languageOwnAddresses = (
  paths: ReadonlyArray<string>,
  language: string,
  languages: ReadonlyArray<string>
): ReadonlyArray<string> =>
  paths.flatMap((path) => {
    const named = leadingLanguageOf(path, languages)
    if (named === undefined) return [withLanguagePrefix(language, path)]
    return named === language ? [path] : []
  })

/**
 * Every address a per-language path is served at, in declaration order. A
 * plain string path gives none: where it is served depends on the languages
 * the app declares, which {@link languageAlternates} reads.
 */
export const localizedPageAddresses = (path: DeclaredPagePath): ReadonlyArray<PageAddress> =>
  isLocalizedPagePath(path)
    ? Object.entries(path).map(([language, value]) => ({
        language,
        path: withLanguagePrefix(language, value),
      }))
    : []

/**
 * The route patterns a page answers to: a plain path as written, or each
 * language-prefixed address of a per-language path.
 */
export const pageRoutePatterns = (path: DeclaredPagePath): ReadonlyArray<string> =>
  isLocalizedPagePath(path) ? localizedPageAddresses(path).map((address) => address.path) : [path]

/** One route pattern a page claims, with the page and its index. */
export interface ClaimedPagePath<P> {
  readonly page: P
  readonly index: number
  readonly path: string
}

/**
 * Every route pattern each page claims, flattened in page order — what a
 * validator reads to refuse a path some other surface owns, naming the page
 * and the exact path. A plain path claims itself, a per-language path each of
 * its addresses.
 */
export const claimedPagePaths = <P extends { readonly path: DeclaredPagePath }>(
  pages: ReadonlyArray<P>
): ReadonlyArray<ClaimedPagePath<P>> =>
  pages.flatMap((page, index) =>
    pageRoutePatterns(page.path).map((path) => ({ page, index, path }))
  )

/**
 * One path standing for the page wherever only its identity matters — a key, a
 * label, a sort order. A plain path is returned unchanged. A per-language path
 * gives its address in `preferredLanguage` when it declares one, else its first
 * address: always a real, served address, read as a path that names its
 * language.
 */
export const primaryPagePath = (path: DeclaredPagePath, preferredLanguage?: string): string => {
  if (!isLocalizedPagePath(path)) return path
  const addresses = localizedPageAddresses(path)
  const preferred = addresses.find((address) => address.language === preferredLanguage)
  return (preferred ?? addresses[0])?.path ?? '/'
}

/** The page answering a request path, and how it matched. */
export interface PageRouteMatch<P> {
  readonly page: P
  /** The page's index in the list searched. */
  readonly index: number
  readonly params: RouteParams
  /** The route pattern that matched: the plain path, or one language's address. */
  readonly pattern: string
  /** The language whose address matched, when the page declares a path per language. */
  readonly language?: string
}

/** One route of the app's route table: a pattern, its page's index, and its language. */
interface PageRoute {
  readonly index: number
  readonly pattern: string
  readonly language: string | undefined
}

/** A page list's route table, flattened in page order, with its patterns alone. */
interface RouteTable {
  readonly routes: ReadonlyArray<PageRoute>
  readonly patterns: ReadonlyArray<string>
}

/**
 * Per-list memo. A page list is immutable and built once per loaded app, so
 * the table every request reads is flattened once per app rather than once per
 * request; a reload builds a new list, which misses here and lets the old entry
 * be collected.
 */
const routeTables = new WeakMap<ReadonlyArray<{ readonly path: DeclaredPagePath }>, RouteTable>()

const routeTableOf = (pages: ReadonlyArray<{ readonly path: DeclaredPagePath }>): RouteTable => {
  const cached = routeTables.get(pages)
  if (cached !== undefined) return cached
  const routes = pages.flatMap((page, index): ReadonlyArray<PageRoute> =>
    isLocalizedPagePath(page.path)
      ? localizedPageAddresses(page.path).map((address) => ({
          index,
          pattern: address.path,
          language: address.language,
        }))
      : [{ index, pattern: page.path, language: undefined }]
  )
  const table = { routes, patterns: routes.map((route) => route.pattern) }
  /* eslint-disable-next-line functional/no-expression-statements --
     the memo write IS the state this module-level cache exists to hold; it is not
     observable, since the table is a pure function of an immutable page list */
  routeTables.set(pages, table)
  return table
}

/**
 * Every route pattern the pages declare, in page order ({@link pageRoutePatterns}
 * of each page) — what deciding whether some page answers an address reads.
 * Computed once per page list.
 */
export const appRoutePatterns = (
  pages: ReadonlyArray<{ readonly path: DeclaredPagePath }>
): ReadonlyArray<string> => routeTableOf(pages).patterns

/**
 * The first page whose route patterns match `path`, in page order — the same
 * first-match rule as before per-language paths existed, a per-language page
 * simply answering to each of its addresses.
 */
export const findPageRoute = <P extends { readonly path: DeclaredPagePath }>(
  pages: ReadonlyArray<P>,
  path: string
): PageRouteMatch<P> | undefined => {
  const { routes, patterns } = routeTableOf(pages)
  const match = findMatchingRoute(patterns, path)
  const route = match === undefined ? undefined : routes[match.index]
  const page = route === undefined ? undefined : pages[route.index]
  if (match === undefined || route === undefined || page === undefined) return undefined
  return {
    page,
    index: route.index,
    params: match.params,
    pattern: route.pattern,
    ...(route.language !== undefined ? { language: route.language } : {}),
  }
}
