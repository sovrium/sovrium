/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve an incoming request path against the app's `redirects` table.
 *
 * Locale matching mirrors `handleLanguagePageRoute`: an EXACT match is tried
 * first, then the request's language prefix is stripped and the bare path is
 * re-matched. A rule whose own `from` already begins with a configured language
 * segment is therefore matched LITERALLY and never through the stripped pass —
 * `/fr/produits` must not invent an English `/en/produits` that never existed.
 *
 * A path target RE-APPLIES the prefix that was stripped, so a French visitor
 * lands on the French replacement. Two targets opt out of that: an absolute
 * `http(s)` target leaves the app entirely, so there is no locale to carry onto
 * it; and `localizeTarget: false` declares a root-relative target that lives
 * outside the locale namespace (`/_admin/login`, a webhook receiver, a health
 * endpoint), where prefixing would manufacture a 404. Both are emitted as
 * authored — and note that `from` still matches every locale variant in the
 * opt-out case, or the French visitor would get no redirect at all.
 *
 * ONE HOP — the resolved target is never re-matched against the table, so
 * `Location` is always literally what the config authored. Rings are rejected at
 * decode time by `RedirectsSchema`, which is what keeps the browser from looping.
 *
 * `stripLanguagePrefix` and `isAbsoluteRedirectTarget` are imported from the
 * schema module rather than re-implemented: the config-side checks and this
 * request-side matcher must agree on both normalization and what counts as an
 * absolute target, or a rule could validate and then never fire — or fire
 * differently than `sovrium validate` accepted it.
 */

import { isAbsoluteRedirectTarget, stripLanguagePrefix } from '@/domain/models/app/redirects'

/** HTTP status a redirect may answer with. */
export type RedirectStatus = 301 | 302 | 307 | 308

/** Minimal shape of a decoded redirect rule needed for matching. */
export interface RedirectRule {
  readonly from: string
  readonly to: string
  readonly status?: RedirectStatus
  /** `false` emits a root-relative target verbatim instead of prefixing it. */
  readonly localizeTarget?: boolean
}

/** A matched redirect: the `Location` header value and the status to answer with. */
export interface RedirectResolution {
  readonly location: string
  readonly status: RedirectStatus
}

/**
 * Status used when a rule omits one — permanent, so a search engine consolidates
 * the retired URL's ranking onto its replacement. Applied HERE rather than as a
 * Schema transformation so `AppEncoded` stays structurally identical to the
 * config the operator wrote.
 */
const DEFAULT_REDIRECT_STATUS: RedirectStatus = 301

/**
 * Resolve the `Location` a matched rule emits under the language it matched
 * beneath.
 *
 * The prefix is re-applied unless the target opts out — either implicitly,
 * because it is absolute and leaves the app, or explicitly via
 * `localizeTarget: false`. Omitting the flag keeps the historical
 * locale-inheriting behaviour exactly, which is the property most at risk from
 * adding the opt-out at all.
 */
const localizeTargetPath = (rule: RedirectRule, language: string): string =>
  rule.localizeTarget === false || isAbsoluteRedirectTarget(rule.to)
    ? rule.to
    : `/${language}${rule.to}`

/**
 * Carry the incoming query string onto the target so campaign attribution
 * survives the move. `search` includes its leading `?`; a target that already
 * carries its own query is extended with `&`.
 */
const appendSearch = (location: string, search: string): string => {
  if (search === '') return location
  return location.includes('?') ? `${location}&${search.slice(1)}` : `${location}${search}`
}

/** The `:name` segments a `from` captured, by name. */
type Captures = Readonly<Record<string, string>>

const segmentsOf = (path: string): readonly string[] => path.split('/').filter(Boolean)

/** Whether a rule's `from` carries a `:name` segment. */
const isParametrised = (from: string): boolean =>
  segmentsOf(from).some((segment) => segment.startsWith(':'))

/**
 * Match a request path against a `from`, capturing its `:name` segments.
 *
 * A `:name` matches exactly ONE non-empty segment, so `/tables/:table` answers
 * neither the bare `/tables` nor `/tables/contacts/export`.
 */
const matchFrom = (from: string, path: string): Captures | undefined => {
  if (!isParametrised(from)) return from === path ? {} : undefined
  const expected = segmentsOf(from)
  const actual = segmentsOf(path)
  if (expected.length !== actual.length) return undefined
  const pairs = expected.map((segment, index) => [segment, actual[index] ?? ''] as const)
  if (pairs.some(([segment, value]) => !segment.startsWith(':') && segment !== value)) {
    return undefined
  }
  return Object.fromEntries(
    pairs
      .filter(([segment]) => segment.startsWith(':'))
      .map(([segment, value]) => [segment.slice(1), value])
  )
}

/** A segment as the visitor meant it — the request path may still be encoded. */
const decodeSegment = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Write each captured segment into the target wherever it names the same
 * `:name`, encoded for where it lands — a path segment and a query value both
 * take `encodeURIComponent`, so `ada@example.com` arrives as `ada%40example.com`.
 */
const fillTarget = (to: string, captures: Captures): string =>
  Object.keys(captures).length === 0
    ? to
    : to.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (whole, name: string) => {
        const value = captures[name]
        return value === undefined ? whole : encodeURIComponent(decodeSegment(value))
      })

/** A rule that answers `path`, with what it captured. */
interface RuleMatch {
  readonly rule: RedirectRule
  readonly captures: Captures
}

/**
 * The rule answering `path` among `rules`. A LITERAL `from` wins over a
 * parametrised one that would also match, whatever the declaration order — so
 * `/users/invitations` can be retired separately from `/users/:email`.
 */
const findRule = (rules: ReadonlyArray<RedirectRule>, path: string): RuleMatch | undefined => {
  const literal = rules.find((rule) => !isParametrised(rule.from) && rule.from === path)
  if (literal !== undefined) return { rule: literal, captures: {} }
  return rules
    .filter((rule) => isParametrised(rule.from))
    .reduce<RuleMatch | undefined>((found, rule) => {
      if (found !== undefined) return found
      const captures = matchFrom(rule.from, path)
      return captures === undefined ? undefined : { rule, captures }
    }, undefined)
}

/**
 * Resolve a request path to its redirect, or `undefined` when no rule declares it.
 *
 * @param rules - The decoded `app.redirects` table.
 * @param languageCodes - Configured language codes (empty when the app is monolingual).
 * @param path - Request path, without query string.
 * @param search - Raw query string including its leading `?`, or `''`.
 */
export const resolveRedirect = (
  rules: ReadonlyArray<RedirectRule>,
  languageCodes: ReadonlyArray<string>,
  path: string,
  search = ''
): RedirectResolution | undefined => {
  const exact = findRule(rules, path)
  if (exact !== undefined) {
    return {
      location: appendSearch(fillTarget(exact.rule.to, exact.captures), search),
      status: exact.rule.status ?? DEFAULT_REDIRECT_STATUS,
    }
  }

  const { language, path: barePath } = stripLanguagePrefix(path, languageCodes)
  if (language === undefined) return undefined

  const localeAgnostic = findRule(
    rules.filter((rule) => stripLanguagePrefix(rule.from, languageCodes).language === undefined),
    barePath
  )
  if (localeAgnostic === undefined) return undefined

  return {
    location: appendSearch(
      fillTarget(localizeTargetPath(localeAgnostic.rule, language), localeAgnostic.captures),
      search
    ),
    status: localeAgnostic.rule.status ?? DEFAULT_REDIRECT_STATUS,
  }
}
