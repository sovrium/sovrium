/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PageQuery } from '@/domain/models/app/pages/query'

/**
 * Resolve every declared `page.query` property against the request URL.
 *
 * The rule is a CLOSED allow-list with a fallback, and the fallback is the
 * whole design: a query string is attacker-controlled and a stale bookmark is
 * not an error condition, so a value outside `enum` resolves to `default` and
 * the page answers 200. Refusing it would turn a shared link into a broken
 * page. Bounding the accepted set is also what keeps the response space finite
 * — `enum.length` renderings rather than one per arbitrary string — which is
 * what makes {@link pageQueryVariantKey} a safe cache dimension.
 *
 * `default ∈ enum` is guaranteed by `collectPageBindingViolations`, so the
 * fallback is always itself a permitted value.
 *
 * ─── TWO FALLBACKS, BECAUSE `default` ANSWERS TWO QUESTIONS ───────────────
 *
 * Without `onUnknown` the fallback is `default` for both "the URL omitted it"
 * and "the URL said something outside `enum`" — right for a period selector,
 * wrong for a FILTER: `?category=nonsense` renders the unfiltered grid, so the
 * page confidently answers a question nobody asked. Declaring `onUnknown`
 * splits the two, and it names an `enum` MEMBER rather than carrying the raw
 * value through, which is what keeps the response space at `enum.length`, keeps
 * attacker-controlled text out of every `$query.<name>` substitution site, and
 * keeps `visibility.query` able to name the resolved state.
 *
 * The key present with an EMPTY value is UNKNOWN, not omitted: every `enum`
 * member is `minLength: 1`, so the empty string can never be one, and
 * "supplied, and not accepted" is the only true reading of it.
 *
 * Absent, this is byte-for-byte the historical behaviour.
 *
 * Pure: the returned map is keyed by property name and always holds an entry
 * for EVERY declared property, whether or not the URL supplied one.
 */
export function resolvePageQueryValues(
  query: PageQuery | undefined,
  requestQuery: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
  if (query === undefined) return {}
  return Object.fromEntries(
    Object.entries(query).map(([name, prop]) => {
      const supplied = requestQuery?.[name]
      if (supplied !== undefined && prop.enum.includes(supplied)) return [name, supplied]
      return [name, supplied === undefined ? prop.default : (prop.onUnknown ?? prop.default)]
    })
  )
}

/**
 * The page-cache key dimension for a set of resolved query values.
 *
 * A page declaring `query` renders differently per value, so keying the cache
 * on the path alone would serve `?period=24h`'s HTML for `?period=30d`. Keying
 * on the RESOLVED values rather than the raw query string is what keeps that
 * safe AND bounded: every value is already clamped into `enum`, so the number
 * of reachable keys is the product of the `enum` lengths. Keying on the raw
 * string instead would let any visitor mint unbounded distinct entries out of
 * one URL.
 *
 * This is the key dimension for what the page's own BODY renders, and it is
 * complete for that. It is deliberately blind to whether a value was supplied
 * at all — `?period=bogus` and the no-parameter request resolve identically —
 * which the NAVIGATION can see even when the body cannot. That half is
 * {@link pageQuerySupplyKey}; the two are separate terms because only one of
 * them may be widened without unbounding the cache.
 *
 * Entries are sorted by name so key order never depends on declaration order.
 * Returns `undefined` when the page declares no query properties, which keeps
 * the key of every existing page byte-identical to what it was.
 */
export function pageQueryVariantKey(values: Readonly<Record<string, string>>): string | undefined {
  const entries = Object.entries(values)
  if (entries.length === 0) return undefined
  return entries
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join('&')
}

/**
 * The page-cache key dimension for HOW each declared property was supplied —
 * the half {@link pageQueryVariantKey} deliberately throws away.
 *
 * ─── WHY THE RESOLVED VALUES ARE NOT A SUFFICIENT KEY ──────────────────────
 *
 * They are sufficient for everything the page's own CONTENT reads, which is
 * what that function was written for and why its "`?period=bogus` shares an
 * entry with the no-parameter request" is true of the body. It is not true of
 * the NAVIGATION. A sidebar entry whose href declares `?category=interactive`
 * is current only when the reader actually carries that pair, so on a page
 * whose `default` IS `interactive` the address `/kit` and the address
 * `/kit?category=interactive` render identical bodies and DIFFERENT
 * `aria-current` — while resolving to the same values and therefore, without
 * this term, to the same cache entry. The second reader is then told they are
 * on the first reader's page.
 *
 * ─── THREE STATES, AND WHY NOT THE RAW VALUE ───────────────────────────────
 *
 * Keying on the raw string would be exactly correct and exactly unbounded: any
 * visitor could mint entries out of one URL, which is the attack
 * {@link pageQueryVariantKey} exists to prevent. So each property contributes
 * one of three states instead, and three is the number the navigation can
 * actually distinguish:
 *
 *   absent    — omitted; no href declaring this property can match
 *   exact     — supplied and inside `enum`, so the resolved value IS the raw
 *               one and an href declaring it matches
 *   unknown   — supplied and outside `enum`; matches no href declaring an
 *               `enum` member, and every such string is indistinguishable from
 *               every other, so they share one entry as before
 *
 * Bounded by the SCHEMA rather than by visitor input: at most 3^n reachable
 * combinations for n declared properties, against `enum.length` alternatives a
 * raw key would leave open.
 *
 * Returns `undefined` when no declared property was supplied, which keeps the
 * cache key byte-identical for every request that carries no query at all.
 */
export function pageQuerySupplyKey(
  query: PageQuery | undefined,
  requestQuery: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (query === undefined) return undefined
  const supplied = Object.entries(query)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .flatMap(([name, prop]) => {
      const value = requestQuery?.[name]
      if (value === undefined) return []
      return [`${name}:${prop.enum.includes(value) ? 'exact' : 'unknown'}`]
    })
  return supplied.length === 0 ? undefined : supplied.join('&')
}
