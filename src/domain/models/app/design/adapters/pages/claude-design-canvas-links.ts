/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a Claude Design board's links lead.
 *
 * A board stays offline, so no link on it leads anywhere: every `href` is `#`,
 * or the link's own `#fragment`. A designer wiring a prototype still has to
 * know which drawn link goes where, so a link whose target is INSIDE the app
 * names it, in two attributes of Sovrium's own:
 *
 * - `data-sovrium-href`, the target as the config writes it (`/records/tickets`,
 *   `?tab=closed`);
 * - `data-sovrium-page`, the name of the app page that address draws, route
 *   parameters matched (`/records/tickets` draws `/records/:table`).
 *
 * A target OUTSIDE the app (any scheme, `//host`) leaves no trace: a network
 * address on a board is what the canvas contract forbids, whatever attribute
 * holds it. Neither attribute is ever read back by the page import.
 */

/** One page of the app, as a link target. */
export interface CanvasLinkRoute {
  readonly name: string
  readonly path: string
}

/** What a board knows when it draws a link: the app's pages, and the page drawn. */
export interface CanvasLinkContext {
  readonly routes: readonly CanvasLinkRoute[]
  readonly page: string
}

/** The attributes a board link carries its target in. */
export const CANVAS_LINK_STAMP = {
  href: 'data-sovrium-href',
  page: 'data-sovrium-page',
} as const

/** A value naming a network resource: an `http(s)://` or a protocol-relative `//host` address. */
export const isNetworkAddress = (value: string): boolean => /^\s*(?:https?:)?\/\//i.test(value)

/** The non-empty segments of a path. */
const segmentsOf = (path: string): readonly string[] =>
  path.split('/').filter((segment) => segment !== '')

/**
 * How well a route pattern matches an address: the number of literal segments
 * it matched, or `undefined` when it does not match.
 */
const matchScore = (pattern: string, address: readonly string[]): number | undefined => {
  const wanted = segmentsOf(pattern)
  if (wanted.length !== address.length) return undefined
  const matched = wanted.map((segment, index) =>
    segment.startsWith(':') ? 0 : segment === address[index] ? 1 : undefined
  )
  return matched.includes(undefined)
    ? undefined
    : matched.reduce<number>((total, score) => total + (score ?? 0), 0)
}

/**
 * The app page an in-app address draws: the route whose pattern matches it,
 * the most literal one first, then the first declared.
 */
export const pageOfAddress = (
  routes: readonly CanvasLinkRoute[],
  address: string
): string | undefined => {
  const path = segmentsOf(address.split(/[?#]/, 1)[0] ?? '')
  const scored = routes.flatMap((route) => {
    const score = matchScore(route.path, path)
    return score === undefined ? [] : [{ name: route.name, score }]
  })
  return scored.reduce<{ readonly name: string; readonly score: number } | undefined>(
    (best, candidate) => (best === undefined || candidate.score > best.score ? candidate : best),
    undefined
  )?.name
}

/**
 * The attributes a board draws for a link's `href`: `#` or its own fragment,
 * plus, for a target inside the app, the target and the page it draws.
 */
export const boardLinkAttributes = (
  href: string,
  context: CanvasLinkContext
): readonly (readonly [string, string])[] => {
  const target = href.trim()
  if (target.startsWith('#')) return [['href', target]]
  if (target.startsWith('?')) {
    return [
      ['href', '#'],
      [CANVAS_LINK_STAMP.href, target],
      [CANVAS_LINK_STAMP.page, context.page],
    ]
  }
  if (!/^\/(?!\/)/.test(target)) return [['href', '#']]
  const page = pageOfAddress(context.routes, target)
  return [
    ['href', '#'],
    [CANVAS_LINK_STAMP.href, target],
    ...(page === undefined ? [] : [[CANVAS_LINK_STAMP.page, page] as const]),
  ]
}
