/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE rule deciding whether a sidebar entry claims the current path.
 *
 * It lives in the domain layer because it has TWO callers in two different
 * runtimes: `resolveSidebarCurrentEntries` runs it on the server against the
 * request path, and the sidebar islands re-run it in the browser against
 * `window.location` after a same-document navigation.
 *
 * A second implementation is the failure this module exists to prevent. The two
 * would agree on the day they were written and drift on the first edit — and
 * the symptom is the worst kind: a nav that answers "where am I" one way before
 * hydration and another way after, with `aria-current` (what a screen reader is
 * actually told) as the thing that disagrees.
 *
 * Pure, dependency-free, and deliberately loose in its `activeMatch` parameter:
 * one caller holds a decoded `SidebarNavItem` and the other holds JSON parsed
 * out of a `data-island-props` attribute.
 */

/**
 * Drop the query string and any trailing slash, keeping the root as `/`.
 *
 * Both sides of every comparison go through this, so `/tables/` and `/tables`
 * are the same destination and `?page=2` never makes an entry stop matching its
 * own page.
 *
 * This is the PATH half of the comparison only. An href that declares a query
 * is additionally held to it by {@link declaredQuerySatisfied} — the two are
 * separate on purpose, because "same destination" and "same filter of that
 * destination" are different questions.
 */
export const normalizeSidebarPath = (path: string): string => {
  const withoutQuery = path.split('?')[0] ?? ''
  const withoutHash = withoutQuery.split('#')[0] ?? ''
  if (withoutHash.length > 1 && withoutHash.endsWith('/')) return withoutHash.slice(0, -1)
  return withoutHash.length === 0 ? '/' : withoutHash
}

/**
 * The query pairs an address declares, decoded.
 *
 * The fragment is stripped FIRST, because `?` after a `#` belongs to the
 * fragment and is not a query at all. Decoding goes through `URLSearchParams`
 * on both sides of every comparison, so an href written `?q=a b` and a request
 * arriving as `?q=a%20b` are the same pair rather than two.
 *
 * ─── A REPEATED NAME RESOLVES FIRST-WINS, TO MATCH HONO ─────────────────────
 *
 * `?category=interactive&category=layout` is one parameter to the server and
 * two to the browser. Hono's `c.req.query()` — which is what
 * {@link sidebarRequestAddress} is handed — collapses a repeated name to its
 * FIRST occurrence (`results[name] ??= value`, `hono/src/utils/url.ts`), and a
 * `Readonly<Record<string, string>>` could not carry the second even if it
 * wanted to. `location.search`, which the islands read, keeps both.
 *
 * The tie-break is NOT arbitrary and is not a preference: it is whichever
 * behaviour the server's parser already has, because Hono is the side that
 * cannot be changed. Last-wins would have been just as defensible in the
 * abstract and just as wrong here.
 *
 * Deduping in this ONE helper — rather than in the two address builders — is
 * what makes the runtimes agree BY CONSTRUCTION rather than by both being
 * edited correctly. Without it the server marks one row and the client marks
 * two, which is the many-rows-carrying-`aria-current` defect the declared query
 * clause below exists to kill, surviving in the corner reachable through
 * Back/Forward after a hand-crafted URL.
 *
 * It applies to the DECLARED side too, where it is a no-op for every href in
 * the product (each authored query is a single `?key=value`). It runs there
 * anyway because the alternative is worse than symmetric: an href declaring a
 * repeated name demanded BOTH values under `declaredQuerySatisfied`, which a
 * collapsed request can never supply — permanently unmatchable on the server,
 * yet matched on the client. The same divergence, pointing the other way.
 */
const sidebarQueryPairs = (address: string): readonly (readonly [string, string])[] => {
  const withoutHash = address.split('#')[0] ?? ''
  const [, ...queryParts] = withoutHash.split('?')
  const query = queryParts.join('?')
  if (query.length === 0) return []
  const pairs = [...new URLSearchParams(query).entries()]
  return pairs.filter(([name], index) => pairs.findIndex(([seen]) => seen === name) === index)
}

/**
 * Whether the request carries every query pair the entry's href declares.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * `activeMatch: 'exact'` is documented as "the request path equals `href`", and
 * without this clause it did not: `normalizeSidebarPath` strips the query from
 * BOTH sides, so twelve kit categories all pointing at `/kit` and told apart
 * only by `?category=` resolved to one string and every one of them matched at
 * once — on the unfiltered page and on every filtered one. `aria-current` is
 * the one element that answers "where am I" for a screen-reader user, and it
 * was answering twelve times.
 *
 * ─── AND WHY IT IS A CONJUNCT RATHER THAN A NEW MATCH MODE ──────────────────
 *
 * An href declaring NO query short-circuits here before the request is even
 * parsed, so it matches by path exactly as it always did, under both `exact`
 * and `prefix`. A reader arriving at `/tables?sort=name` has not left
 * `/tables`, and the `/tables` entry must still say so. The narrowing applies
 * only to an href that opted in by declaring a filter of its own.
 *
 * SUBSET and not equality, for the same reason: an entry declaring
 * `?category=interactive` still claims the page when the reader also carries a
 * `?page=2` it knows nothing about. Demanding equality would make an entry stop
 * marking itself the moment any unrelated parameter joined the address.
 */
const declaredQuerySatisfied = (href: string, fullPath: string): boolean => {
  const declared = sidebarQueryPairs(href)
  if (declared.length === 0) return true
  const requested = sidebarQueryPairs(fullPath)
  return declared.every(([name, value]) =>
    requested.some(
      ([requestedName, requestedValue]) => requestedName === name && requestedValue === value
    )
  )
}

/**
 * Whether an entry claims `fullPath`.
 *
 * `fullPath` is the live ADDRESS, not just its path: it may carry the query,
 * and must whenever any entry in the sidebar declares one. The server builds it
 * with {@link sidebarRequestAddress} and the islands read it off
 * `window.location`; both go through this one function so the two runtimes
 * cannot come to disagree about what a mark means.
 *
 * `exact` is the default because `prefix` on a root entry (`href: '/'`) marks
 * EVERY page of the app as current — the mistake a hand-written sidebar makes
 * first, and the reason the choice is per entry rather than per sidebar.
 *
 * `prefix` matches the entry's own page and anything BELOW it (`href/…`), never
 * a sibling that merely starts with the same characters: `/tables` must not
 * claim `/tables-archive`, which a bare `startsWith` would hand it.
 *
 * The separator is appended unconditionally, which also makes a ROOT entry
 * (`href: '/'`) declaring `prefix` match nothing but `/` — the target becomes
 * `//`, which no path begins with. That is deliberate: it is the one case where
 * honouring `prefix` literally would mark every page in the app at once, and a
 * navigation claiming to be everywhere tells the reader as little as one
 * claiming to be nowhere.
 */
export const sidebarEntryMatches = (
  href: string,
  activeMatch: unknown,
  fullPath: string
): boolean => {
  const target = normalizeSidebarPath(href)
  const current = normalizeSidebarPath(fullPath)
  const pathMatches =
    activeMatch === 'prefix'
      ? current === target || current.startsWith(`${target}/`)
      : target === current
  return pathMatches && declaredQuerySatisfied(href, fullPath)
}

/**
 * The address the server compares entries against: the request path, plus the
 * request query when there is one.
 *
 * Serialised here rather than at the call site so the encoding and the decoding
 * in {@link sidebarQueryPairs} sit beside each other and cannot drift — the
 * round trip through `URLSearchParams` is what makes the server's record and
 * the browser's `location.search` the same pairs.
 *
 * The query is the RAW one off the request. A page's `query` DEFAULTS must not
 * reach here: an entry declaring `?category=interactive` would then mark itself
 * on the unfiltered page, which is the very thing this pair of functions is for.
 */
export const sidebarRequestAddress = (
  path: string,
  query?: Readonly<Record<string, string>>
): string => {
  const serialised = query === undefined ? '' : new URLSearchParams({ ...query }).toString()
  return serialised.length === 0 ? path : `${path}?${serialised}`
}
