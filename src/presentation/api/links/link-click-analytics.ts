/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the request says about a visitor, and what a click records about them.
 *
 * Extracted verbatim from `route-setup/link-routes.ts` in W5c. The two halves
 * live together because they read the SAME request through the same
 * `parseUserAgent` call: {@link visitorContext} turns it into the facts the
 * target predicate filters on, and {@link recordClick} turns it into the row
 * the analytics readers aggregate. Splitting them would mean parsing one
 * user-agent twice per redirect and leaving two places free to disagree about
 * what a "device" is.
 *
 * Every analytics read here is best-effort by design — see the individual
 * swallows. A click that cannot be counted must never turn a working link into
 * an error, because the redirect has already been decided by the time any of
 * this runs.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { parseUserAgent } from '@/application/use-cases/analytics/ua-parser'
import {
  computeSessionHash,
  computeVisitorHash,
} from '@/application/use-cases/analytics/visitor-hash'
import { PROXY_COUNTRY_HEADERS, parseAcceptLanguage } from '@/domain/models/app/links/link-resolver'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import type { App } from '@/domain/models/app'
import type { ResolvableLink, VisitorContext } from '@/domain/models/app/links/link-resolver'
import type { Context } from 'hono'

/** Analytics is off unless the app declares it — the same gate page views use. */
const analyticsEnabled = (app: App): boolean =>
  app.analytics !== undefined && app.analytics !== false

const sessionTimeout = (app: App): number =>
  typeof app.analytics === 'object' ? (app.analytics.sessionTimeout ?? 30) : 30

const respectsDoNotTrack = (app: App): boolean =>
  typeof app.analytics === 'object' ? (app.analytics.respectDoNotTrack ?? true) : true

/**
 * How many clicks this link has already been credited with.
 *
 * Counted over `system.analytics_events` because that is the ONE place a click is
 * written ([internal ref] D6). Two consequences are accepted and documented in the user
 * story rather than worked around here: the count is bounded by the analytics
 * retention window, and counting-then-deciding is not atomic, so a burst may
 * overshoot a cap by a small number.
 *
 * Returns 0 when analytics is disabled — a cap cannot be enforced against a
 * store nothing is being written to, and refusing to serve would be worse than
 * not capping.
 */
const countClicks = async (c: Context, appName: string, slug: string): Promise<number> => {
  const program = Effect.gen(function* () {
    const repository = yield* AnalyticsRepository
    const result = yield* repository.listEvents({
      appName,
      eventType: 'link_click',
      eventName: slug,
      limit: 1,
    })
    return result.pagination.total
  })

  return Effect.runPromise(
    provideDomain(c, program).pipe(
      // effect-swallow: 0 is the documented answer for "the store cannot say" — see the doc comment above, which decides that a cap unenforceable against an unreadable analytics store must not stop the redirect. It DOES mean an exhausted link keeps resolving while analytics is down; that trade is the stated one.
      Effect.orElseSucceed(() => 0)
    )
  )
}

/**
 * The click count the resolver needs — counted only when a cap exists.
 *
 * A link with no `maxClicks` can never be exhausted, so querying the analytics
 * store for it would be a per-redirect round trip bought for nothing.
 */
export const creditedClicks = async (
  c: Context,
  appName: string,
  link: ResolvableLink,
  slug: string
): Promise<number> => (link.lifecycle?.maxClicks === undefined ? 0 : countClicks(c, appName, slug))

/**
 * The campaign attribution to record, read off the RESOLVED DESTINATION.
 *
 * The destination is the merged truth: `buildDestinationUrl` has already applied
 * the three-way precedence (destination's own query > incoming request param >
 * the link's declared `utm` block), so re-deriving from the incoming request
 * here would record the values that were OVERRIDDEN rather than the ones the
 * visitor actually arrived with — and the click report would disagree with the
 * page views it is meant to sit alongside.
 */
const mergedUtm = (destination: string): Readonly<Record<string, string>> => {
  // `URL.parse` yields null rather than throwing on a malformed input, which is
  // what keeps this a total function — a destination that cannot be parsed
  // records no attribution instead of losing the whole click.
  const parsed = URL.parse(destination) ?? undefined
  if (parsed === undefined) return {}

  return Object.fromEntries(
    (
      [
        ['utmSource', 'utm_source'],
        ['utmMedium', 'utm_medium'],
        ['utmCampaign', 'utm_campaign'],
        ['utmContent', 'utm_content'],
        ['utmTerm', 'utm_term'],
      ] as const
    )
      .map(
        ([property, param]) =>
          [property, parsed.searchParams.get(param) ?? undefined] as readonly [
            string,
            string | undefined,
          ]
      )
      .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
  )
}

/**
 * Record one click, fire-and-forget.
 *
 * Property KEYS deliberately mirror a page view's, which is what lets the six
 * reused analytics readers aggregate clicks with no per-type mapping layer.
 */
export const recordClick = (
  c: Context,
  app: App,
  input: {
    readonly slug: string
    readonly destination: string
    readonly targetIndex: number
    readonly isScan: boolean
  }
): void => {
  if (!analyticsEnabled(app)) return
  if (respectsDoNotTrack(app) && c.req.header('DNT') === '1') return

  const userAgent = c.req.header('user-agent') ?? ''

  const program = Effect.gen(function* () {
    const repository = yield* AnalyticsRepository
    // effect-promise: total -- both hash helpers wrap `crypto.subtle.digest('SHA-256', …)` over a `TextEncoder` result; SHA-256 is always available and the input is always a valid BufferSource, so the digest has no rejection path.
    const visitorHash = yield* Effect.promise(() =>
      computeVisitorHash(getRequestClientIp(c), userAgent, app.name)
    )
    // effect-promise: total -- both hash helpers wrap `crypto.subtle.digest('SHA-256', …)` over a `TextEncoder` result; SHA-256 is always available and the input is always a valid BufferSource, so the digest has no rejection path.
    const sessionHash = yield* Effect.promise(() =>
      computeSessionHash(visitorHash, sessionTimeout(app))
    )
    const agent = parseUserAgent(userAgent)
    const referrer = c.req.header('referer') ?? c.req.header('referrer')

    yield* repository.recordEvent({
      appName: app.name,
      eventType: input.isScan ? 'qr_scan' : 'link_click',
      eventName: input.slug,
      visitorHash,
      sessionHash,
      properties: {
        slug: input.slug,
        destination: input.destination,
        targetIndex: input.targetIndex,
        deviceType: agent.deviceType,
        browserName: agent.browserName,
        osName: agent.osName,
        ...(referrer === undefined ? {} : { referrerUrl: referrer }),
        ...mergedUtm(input.destination),
      },
    })
  })

  // effect-swallow: fire-and-forget by design — the redirect has already been decided, and a click row that cannot be written must not turn a working link into an error.
  const recorded = provideDomain(c, program).pipe(Effect.ignore)
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget by design: the redirect must not wait on (or fail with) the analytics write. `ignoreVoid` does not cover the `void` operator, so the suppression is the only lever; same idiom as analytics.ts.
  void Effect.runPromise(recorded)
}

/**
 * What the request tells us about the visitor, for the predicate filter.
 *
 * Device and OS come from `parseUserAgent`, which is already in the request path
 * for the click event — so targeting on them costs nothing new.
 *
 * COUNTRY IS READ FROM A PROXY HEADER OR NOT AT ALL. A self-hosted app has no IP
 * database and adding one breaks the zero-dependency rule, so the only honest
 * source is a header something in front of the app set. When none is present the
 * field stays `undefined`, the predicate does not match, and the visitor falls
 * through to the target that declares no `when` — fail open, never closed.
 */
export const visitorContext = (c: Context): VisitorContext => {
  const agent = parseUserAgent(c.req.header('user-agent') ?? '')
  const country = PROXY_COUNTRY_HEADERS.map((header) => c.req.header(header)).find(
    (value) => value !== undefined && value.trim() !== ''
  )

  return {
    ...(country === undefined ? {} : { country: country.trim() }),
    device: agent.deviceType,
    os: agent.osName,
    languages: parseAcceptLanguage(c.req.header('accept-language')),
  }
}
