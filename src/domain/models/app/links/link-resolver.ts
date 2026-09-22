/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Short-link resolution — the pure half.
 *
 * Everything here is a function of its arguments: no clock, no database, no
 * randomness of its own. `now`, the click count and the random draw are passed
 * IN, which is what lets the lifecycle rules be tested at their boundaries
 * instead of around them.
 *
 * The impure half — looking the link up, counting its clicks, recording the
 * event — lives in the route mount.
 */

import { linkTargets } from '.'
import type { LinkTargetPredicate, ResolvableLinkTarget } from '.'

/** The QR marker appended to an encoded URL, stripped before forwarding. */
export const QR_MARKER_PARAM = 'qr'

/** What the runtime should do with a request for a link. */
export type LinkOutcome =
  | { readonly kind: 'redirect'; readonly location: string; readonly targetIndex: number }
  | { readonly kind: 'gone'; readonly location?: string }
  | { readonly kind: 'gated' }

/** The subset of a link this module needs, from config or from a database row. */
export interface ResolvableLink {
  readonly slug: string
  readonly to?: string | undefined
  readonly targets?: ReadonlyArray<ResolvableLinkTarget>
  /**
   * Present when the link is gated. The VALUE is irrelevant here — the route
   * resolves the `$env.` reference and reports whether what the visitor supplied
   * matched, so this module never handles a secret.
   */
  readonly password?: string | undefined
  readonly lifecycle?:
    | {
        readonly enabled?: boolean | undefined
        readonly validFrom?: string | undefined
        readonly validUntil?: string | undefined
        readonly maxClicks?: number | undefined
        readonly expiredTo?: string | undefined
      }
    | undefined
  readonly utm?:
    | {
        readonly source?: string | undefined
        readonly medium?: string | undefined
        readonly campaign?: string | undefined
        readonly content?: string | undefined
        readonly term?: string | undefined
      }
    | undefined
}

/**
 * Why a link is not serving, when it is not.
 *
 * Reported separately from the outcome because the console renders it and the
 * redirect handler does not — and because collapsing `scheduled` and `expired`
 * into one "inactive" would leave an operator unable to tell a link that has not
 * started from one that has finished, which call for opposite actions.
 */
export type LinkState = 'active' | 'disabled' | 'scheduled' | 'expired' | 'exhausted'

/**
 * The state a link is in, computed the SAME way for the redirect handler and the
 * admin catalog.
 *
 * One function, deliberately: a catalog computing state on its own would drift,
 * and the operator would read "active" for a link whose visitors get a 410.
 */
const beforeWindow = (validFrom: string | undefined, at: number): boolean => {
  if (validFrom === undefined) return false
  const from = Date.parse(validFrom)
  return !Number.isNaN(from) && at < from
}

const afterWindow = (validUntil: string | undefined, at: number): boolean => {
  if (validUntil === undefined) return false
  const until = Date.parse(validUntil)
  return !Number.isNaN(until) && at > until
}

export const resolveLinkState = (
  link: ResolvableLink,
  context: { readonly now: Date; readonly clickCount: number }
): LinkState => {
  const { lifecycle } = link
  if (lifecycle === undefined) return 'active'
  if (lifecycle.enabled === false) return 'disabled'

  const at = context.now.getTime()
  if (beforeWindow(lifecycle.validFrom, at)) return 'scheduled'
  if (afterWindow(lifecycle.validUntil, at)) return 'expired'

  // `>=` rather than `>`: `maxClicks: 2` must SERVE two clicks and refuse the
  // third. An off-by-one here is the difference between a promotion honouring
  // its stated limit and shorting the last person through the door.
  if (lifecycle.maxClicks !== undefined && context.clickCount >= lifecycle.maxClicks) {
    return 'exhausted'
  }

  return 'active'
}

/**
 * Choose among a link's candidate destinations by weight.
 *
 * `draw` is a caller-supplied number in [0, 1) so the pick is deterministic
 * under test. An unweighted target counts as 1 — treating an absent weight as 0
 * would silently drop a declared destination out of the rotation, which reads in
 * the config as if it were still participating.
 */
export const pickTargetIndex = (
  targets: ReadonlyArray<{ readonly weight?: number | undefined }>,
  draw: number
): number => {
  if (targets.length <= 1) return 0

  const weights = targets.map((target) => target.weight ?? 1)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 0

  // Cumulative bounds, then the first bound the draw falls under. Equivalent to
  // walking a running total, without a mutable cursor.
  const bounds = weights.reduce<readonly number[]>(
    (acc, weight) => [...acc, (acc.at(-1) ?? 0) + weight],
    []
  )
  const threshold = draw * total
  const index = bounds.findIndex((bound) => threshold < bound)
  return index === -1 ? targets.length - 1 : index
}

/**
 * What the runtime knows about the visitor, for the predicate filter.
 *
 * Every field is optional because every field can genuinely be absent: a
 * request may carry no User-Agent, no `Accept-Language`, and — the common case
 * for a self-hosted deployment — no country header at all.
 */
export interface VisitorContext {
  /** From a reverse-proxy header only. `undefined` means nobody told us. */
  readonly country?: string | undefined
  readonly device?: string | undefined
  readonly os?: string | undefined
  /** Primary subtags from `Accept-Language`, in the order declared. */
  readonly languages?: readonly string[] | undefined
}

/**
 * The reverse-proxy headers a country may arrive in, in the order consulted.
 *
 * ONE list, because "which header carries the country" is a deployment fact the
 * operator cannot configure and should not have to: an app moved from Cloudflare
 * to Vercel keeps working. Anything not on this list is not a country source —
 * trusting an arbitrary caller-supplied header would let a visitor pick their
 * own targeting, which is worse than having no geo at all.
 */
export const PROXY_COUNTRY_HEADERS: readonly string[] = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-country-code',
]

/**
 * The primary language subtags an `Accept-Language` header names.
 *
 * Returned as a membership SET rather than a ranked preference list: the
 * predicate asks "does this visitor read French", which `q` weights do not
 * change the answer to. Ranking would matter only if two language-predicated
 * targets could both match, and specificity already decides that case.
 */
export const parseAcceptLanguage = (header: string | undefined): readonly string[] =>
  (header ?? '')
    .split(',')
    .map((part) => (part.split(';')[0] ?? '').trim().split('-')[0] ?? '')
    .filter((subtag) => subtag !== '' && subtag !== '*')
    .map((subtag) => subtag.toLowerCase())

/** Case-insensitive membership, so a config saying `ios` meets a parser saying `iOS`. */
const listMatches = (
  declared: readonly string[] | undefined,
  actual: string | undefined
): boolean =>
  declared === undefined ||
  (actual !== undefined && declared.some((value) => value.toLowerCase() === actual.toLowerCase()))

/**
 * Whether a target's predicate admits this visitor.
 *
 * EVERY declared key must match — `{ device: ['mobile'], os: ['ios'] }` reads as
 * mobile AND iOS, which is what makes a per-platform deep link possible at all.
 *
 * A predicate whose data source said nothing does NOT match. That is the fail-
 * open half of the geo rule, and it is expressed here rather than at the header
 * read so it holds for a missing User-Agent too: an unknown visitor falls
 * through to the target that claims nobody in particular.
 */
export const matchesPredicate = (
  when: LinkTargetPredicate | undefined,
  visitor: VisitorContext
): boolean => {
  if (when === undefined) return true
  if (!listMatches(when.country, visitor.country)) return false
  if (!listMatches(when.device, visitor.device)) return false
  if (!listMatches(when.os, visitor.os)) return false
  if (when.language === undefined) return true

  const declared = when.language
  return (visitor.languages ?? []).some((language) =>
    declared.some((value) => value.toLowerCase() === language.toLowerCase())
  )
}

/** How narrow a predicate is: the number of keys it constrains. */
const specificity = (when: LinkTargetPredicate | undefined): number =>
  when === undefined
    ? 0
    : [when.country, when.device, when.os, when.language].filter((value) => value !== undefined)
        .length

/**
 * Narrow a link's target list to the ones this visitor may be sent to.
 *
 * Returned WITH the original indices, because `targetIndex` is the analytics
 * join key: an index into a filtered list would name a different destination on
 * every request, and the A/B report would be built on a key that means nothing.
 *
 * THE MORE SPECIFIC PREDICATE WINS. When an iPhone satisfies both
 * `{ device: ['mobile'] }` and `{ device: ['mobile'], os: ['ios'] }`, only the
 * second survives. Without this, declaration order decides — and an author
 * adding a broad rule later would silently capture traffic from every narrow
 * rule below it, with nothing in the diff saying so.
 *
 * Falls back to the unpredicated targets when nothing matched, and to the whole
 * list when there are none. Config cannot reach that last case (validation
 * refuses a link whose every target is predicated), but a row minted through the
 * console can, and a link that resolves to nothing would be a 410 for a link
 * that is very much alive.
 */
export const eligibleTargets = (
  targets: ReadonlyArray<ResolvableLinkTarget>,
  visitor: VisitorContext
): ReadonlyArray<{ readonly target: ResolvableLinkTarget; readonly index: number }> => {
  const indexed = targets.map((target, index) => ({ target, index }))

  const matched = indexed.filter(
    (entry) => entry.target.when !== undefined && matchesPredicate(entry.target.when, visitor)
  )
  if (matched.length > 0) {
    const narrowest = Math.max(...matched.map((entry) => specificity(entry.target.when)))
    return matched.filter((entry) => specificity(entry.target.when) === narrowest)
  }

  const unpredicated = indexed.filter((entry) => entry.target.when === undefined)
  return unpredicated.length > 0 ? unpredicated : indexed
}

/**
 * Merge campaign parameters onto a destination.
 *
 * PRECEDENCE, decided once and implemented only here:
 *
 *   1. the destination's own query string — the most explicit statement of
 *      intent an author can make, so it is never overwritten;
 *   2. the incoming request query — a deliberate per-share override;
 *   3. the link's declared `utm` block — the default for shares that say nothing.
 *
 * The QR marker is OURS, not the destination's, so it is dropped rather than
 * forwarded: leaking it would put `qr=1` into the customer's own analytics.
 */
export const buildDestinationUrl = (
  destination: string,
  utm: ResolvableLink['utm'],
  requestSearch: string
): string => {
  const [base = '', destinationQuery = ''] = destination.split('?', 2)

  const utmEntries: ReadonlyArray<readonly [string, string | undefined]> = [
    ['utm_source', utm?.source],
    ['utm_medium', utm?.medium],
    ['utm_campaign', utm?.campaign],
    ['utm_content', utm?.content],
    ['utm_term', utm?.term],
  ]

  // Ordered by precedence. `firstWins` below keeps the earliest occurrence of a
  // key, so this array IS the precedence rule — there is nowhere else to change it.
  const ordered: ReadonlyArray<readonly [string, string]> = [
    ...new URLSearchParams(destinationQuery),
    ...[...new URLSearchParams(requestSearch)].filter(([key]) => key !== QR_MARKER_PARAM),
    ...utmEntries.filter((entry): entry is readonly [string, string] => {
      const [, value] = entry
      return value !== undefined && value !== ''
    }),
  ]

  const firstWins = ordered.reduce<ReadonlyMap<string, string>>(
    (acc, [key, value]) => (acc.has(key) ? acc : new Map([...acc, [key, value] as const])),
    new Map()
  )

  const query = new URLSearchParams([...firstWins]).toString()
  return query === '' ? base : `${base}?${query}`
}

/**
 * Decide what a request for this link should receive.
 *
 * A dead link answers **410 Gone**, not 404: the URL genuinely did exist, and 410
 * tells a crawler to drop it and a human that it expired rather than that they
 * mistyped. `expiredTo` opts into a redirect instead — the case that matters for
 * print, where the artefact cannot be recalled.
 *
 * RESOLUTION ORDER, stated once because every combination has to have one
 * answer: **lifecycle → password → predicates → weight.**
 *
 * Lifecycle first is not a stylistic choice. An expired GATED link answers 410
 * without prompting: asking for a password to something that no longer exists
 * wastes the visitor's time and — worse — tells them a password would have
 * worked. Password before predicates for the mirror reason: an ungated visitor
 * must never learn anything about the destination, and which target they would
 * have been routed to is information about it.
 */
export const resolveLinkOutcome = (
  link: ResolvableLink,
  context: {
    readonly now: Date
    readonly clickCount: number
    readonly requestSearch: string
    readonly draw: number
    /** The visitor facts the predicate filter reads. Absent ⇒ nothing is known. */
    readonly visitor?: VisitorContext | undefined
    /** Whether the caller verified a supplied password against the gate. */
    readonly passwordSatisfied?: boolean | undefined
  }
): LinkOutcome => {
  const state = resolveLinkState(link, context)
  if (state !== 'active') {
    const expiredTo = link.lifecycle?.expiredTo
    return expiredTo === undefined ? { kind: 'gone' } : { kind: 'gone', location: expiredTo }
  }

  if (link.password !== undefined && context.passwordSatisfied !== true) return { kind: 'gated' }

  const eligible = eligibleTargets(linkTargets(link), context.visitor ?? {})
  const chosen =
    eligible[
      pickTargetIndex(
        eligible.map((entry) => entry.target),
        context.draw
      )
    ]
  if (chosen === undefined) return { kind: 'gone' }

  return {
    kind: 'redirect',
    location: buildDestinationUrl(chosen.target.to, link.utm, context.requestSearch),
    // The index into the DECLARED list, not the filtered one — see `eligibleTargets`.
    targetIndex: chosen.index,
  }
}
