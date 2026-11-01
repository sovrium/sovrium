/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isLocalizedPagePath,
  leadingLanguageOf,
  withLanguagePrefix,
  withLanguageSegment,
  type DeclaredPagePath,
} from '@/domain/kernel/matching/localized-path'

/** What the rewrite reads of an app: its pages' paths and its language codes. */
export interface RedirectTargetLanguageInput {
  readonly pages?: ReadonlyArray<{ readonly path: DeclaredPagePath }> | undefined
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> } | undefined
}

/** `redirectTo` split at its query or fragment, so only the path is compared. */
const splitAddress = (address: string): readonly [string, string] => {
  const cut = address.search(/[?#]/)
  return cut === -1 ? [address, ''] : [address.slice(0, cut), address.slice(cut)]
}

/**
 * The address of the page `path` names, in `language`: a page declared at that
 * one path is served under every prefix, a page declaring a path per language
 * answers with that language's own slug. `undefined` when no page is declared
 * at `path`, or when the page it names has no version in `language`.
 */
const pageAddressIn = (
  pages: ReadonlyArray<{ readonly path: DeclaredPagePath }>,
  path: string,
  language: string
): string | undefined => {
  const named = pages.find((page) =>
    isLocalizedPagePath(page.path) ? Object.values(page.path).includes(path) : page.path === path
  )
  if (named === undefined) return undefined
  if (!isLocalizedPagePath(named.path)) return withLanguageSegment(language, path)
  const own = named.path[language]
  return own === undefined ? undefined : withLanguagePrefix(language, own)
}

/**
 * Where an access rule's `redirectTo` sends a visitor who asked for
 * `requestPath`, in the language that address names. A page read under a
 * `/{lang}/` prefix sends her to that language's version of the `redirectTo`
 * page, query kept, so `/fr/…` leads to the French sign-in page rather than to
 * a bare path the router would answer in another language. `redirectTo` is
 * returned as written when the request names no language, when it already
 * names one, when it names no page, or when that page has no version in the
 * request's language.
 */
export const redirectTargetInRequestLanguage = (
  app: RedirectTargetLanguageInput,
  redirectTo: string,
  requestPath: string | undefined
): string => {
  const codes = app.languages?.supported.map((language) => language.code) ?? []
  const language = requestPath === undefined ? undefined : leadingLanguageOf(requestPath, codes)
  const [path, rest] = splitAddress(redirectTo)
  if (language === undefined || leadingLanguageOf(path, codes) !== undefined) return redirectTo
  const address = pageAddressIn(app.pages ?? [], path, language)
  return address === undefined ? redirectTo : `${address}${rest}`
}
