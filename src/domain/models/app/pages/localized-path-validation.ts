/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-validation of per-language page paths (`path: { en: /manifesto, fr: /manifeste }`).
 *
 * Three refusals, each naming the page and the path:
 *
 *  1. a language code the app does not declare in `languages.supported` — the
 *     page would have an address in a language nothing else serves;
 *  2. a value that already starts with a declared language code — the engine
 *     adds the `/{lang}` prefix itself, so `fr: /fr/manifeste` would be served
 *     at `/fr/fr/manifeste`;
 *  3. a value carrying a `:lang` segment — the map's key already names the
 *     language, so the page would be served under a doubled language prefix;
 *  4. two pages claiming the same localized address — one of them would be
 *     silently unreachable.
 *
 * Rule 4 compares only addresses a per-language path takes part in, so two
 * plain-string pages are judged exactly as they were before per-language paths
 * existed. A plain path that names no language is served under every language
 * prefix, so it claims `/{lang}{path}` for every declared language; a plain
 * path starting with a language code claims itself. Dynamic segments compare
 * by position, not by parameter name: `/fr/articles/:slug` and
 * `/fr/articles/:id` are the same address.
 *
 * Standalone module (like `redirects-validation.ts`) so the `AppSchema` filter
 * chain stays shallow: each extra filter pushes TypeScript's inference depth
 * towards collapsing the derived `App` type.
 */

import {
  isLocalizedPagePath,
  leadingLanguageOf,
  localizedPageAddresses,
  withLanguagePrefix,
} from '@/domain/kernel/matching/localized-path'
import { validateAllRedirectRules } from '../redirects/redirects-validation'

/** Minimal app shape this validation reads. */
interface AppForLocalizedPathValidation {
  readonly pages?: ReadonlyArray<{
    readonly name: string
    readonly path: string | Readonly<Record<string, string>>
  }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
}

/** One address a page answers at, with the page that claims it. */
interface ClaimedAddress {
  readonly page: string
  readonly address: string
  readonly localized: boolean
}

/** The address with every dynamic segment reduced to its position. */
const comparable = (address: string): string => address.replace(/\/:[^/]+/g, '/:')

const refuseUndeclaredLanguages = (
  name: string,
  paths: Readonly<Record<string, string>>,
  codes: ReadonlyArray<string>
): true | string => {
  const unknown = Object.keys(paths).find((code) => !codes.includes(code))
  if (unknown === undefined) return true
  const declared =
    codes.length === 0
      ? 'the app declares no languages'
      : `languages.supported declares ${codes.join(', ')}`
  return `Page "${name}" declares a path for language "${unknown}" (${paths[unknown]}), but ${declared}`
}

const refusePrefixedValues = (
  name: string,
  paths: Readonly<Record<string, string>>,
  codes: ReadonlyArray<string>
): true | string => {
  const entry = Object.entries(paths).find(
    ([, path]) => leadingLanguageOf(path, codes) !== undefined
  )
  if (entry === undefined) return true
  const [code, path] = entry
  const bare = path.slice(`/${leadingLanguageOf(path, codes) ?? ''}`.length) || '/'
  return `Page "${name}" writes its "${code}" path as ${path}; write ${bare} instead, the /${code} prefix is added for you`
}

const refuseLangSegments = (
  name: string,
  paths: Readonly<Record<string, string>>
): true | string => {
  const entry = Object.entries(paths).find(([, path]) => path.split('/').includes(':lang'))
  if (entry === undefined) return true
  const [code, path] = entry
  return `Page "${name}" writes its path for language "${code}" (${path}) with a :lang segment; the map's key already names the language, so remove :lang`
}

/** Every address a page claims under the declared languages. */
const claimedAddresses = (
  page: NonNullable<AppForLocalizedPathValidation['pages']>[number],
  codes: ReadonlyArray<string>
): ReadonlyArray<ClaimedAddress> => {
  if (isLocalizedPagePath(page.path)) {
    return localizedPageAddresses(page.path).map(({ path }) => ({
      page: page.name,
      address: path,
      localized: true,
    }))
  }
  const plain = page.path
  const addresses =
    leadingLanguageOf(plain, codes) !== undefined
      ? [plain]
      : codes.map((code) => withLanguagePrefix(code, plain))
  return addresses.map((address) => ({ page: page.name, address, localized: false }))
}

const refuseSharedAddresses = (
  pages: NonNullable<AppForLocalizedPathValidation['pages']>,
  codes: ReadonlyArray<string>
): true | string => {
  const claims = pages.flatMap((page) => claimedAddresses(page, codes))
  const clash = claims
    .filter((claim) => claim.localized)
    .flatMap((claim) =>
      claims
        .filter(
          (other) =>
            other.page !== claim.page && comparable(other.address) === comparable(claim.address)
        )
        .map((other) => ({ claim, other }))
    )
    .at(0)
  if (clash === undefined) return true
  return `Pages "${clash.claim.page}" and "${clash.other.page}" both claim ${clash.claim.address}; each localized address belongs to one page`
}

/**
 * Validate every per-language page path of the app.
 *
 * @returns `true` when valid, otherwise the first refusal, naming the page and the path
 */
export const validateLocalizedPagePaths = (app: AppForLocalizedPathValidation): true | string => {
  const pages = app.pages ?? []
  if (!pages.some((page) => isLocalizedPagePath(page.path))) return true
  const codes = (app.languages?.supported ?? []).map((language) => language.code)
  const pageError = pages
    .flatMap((page) => {
      if (!isLocalizedPagePath(page.path)) return []
      const languageError = refuseUndeclaredLanguages(page.name, page.path, codes)
      if (languageError !== true) return [languageError]
      const prefixError = refusePrefixedValues(page.name, page.path, codes)
      if (prefixError !== true) return [prefixError]
      const langError = refuseLangSegments(page.name, page.path)
      return langError === true ? [] : [langError]
    })
    .at(0)
  return pageError ?? refuseSharedAddresses(pages, codes)
}

/** The app shape {@link validatePageAddresses} reads: pages, languages and redirects. */
type AppForPageAddressValidation = AppForLocalizedPathValidation &
  Omit<Parameters<typeof validateAllRedirectRules>[0], 'pages' | 'languages'>

/**
 * Page-address cross-validation, grouped for the complexity budget of the
 * final `AppSchema` filter: per-language page paths first, then the redirects
 * that would shadow a page.
 */
export const validatePageAddresses = (app: AppForPageAddressValidation): true | string => {
  const localizedPathError = validateLocalizedPagePaths(app)
  if (localizedPathError !== true) return localizedPathError
  return validateAllRedirectRules(app)
}
