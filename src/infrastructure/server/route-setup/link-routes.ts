/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Mount the `app.links` table at `/l/{slug}`.
 *
 * MOUNT ORDER is load-bearing in both directions, as it is for redirects:
 *
 * - AFTER the public-directory route, so a real shipped file always wins and a
 *   link can never hijack a path the app already serves.
 * - BEFORE the page routes. This one is MANDATORY rather than stylistic:
 *   `setupLanguageRoutes` registers `/:lang/*`, which matches `/l/abc`, and its
 *   handler renders a 404 terminally rather than calling `next()`. Mounted after
 *   pages, every short link would 404.
 *
 * ONE HANDLER for both `/l/{slug}` and `/l/{slug}.svg`, not two param routes.
 * The slug charset forbids `.`, so `token.endsWith('.svg')` is an EXACT
 * discriminator — there is no slug for which the suffix split is wrong — and one
 * handler cannot disagree with itself about which link it resolved.
 */

import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import {
  LinkRepository,
  type LinkRecord,
} from '@/application/ports/repositories/links/link-repository'
import { parseUserAgent } from '@/application/use-cases/analytics/ua-parser'
import {
  computeSessionHash,
  computeVisitorHash,
} from '@/application/use-cases/analytics/visitor-hash'
import {
  buildEnvLookup,
  resolveEnvInString,
} from '@/application/use-cases/automations/resolve-env-vars'
import { renderLinkGatePage } from '@/domain/services/link-gate-page'
import { encodeQrSvg } from '@/domain/services/qr-code'
import {
  PROXY_COUNTRY_HEADERS,
  QR_MARKER_PARAM,
  parseAcceptLanguage,
  resolveLinkOutcome,
} from '@/domain/utils/matching/link-resolver'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import { requestSearch } from '@/infrastructure/server/request-search'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import { provideAnalyticsLive } from '@/presentation/api/routes/analytics/effect-runner'
import type { App } from '@/domain/models/app'
import type {
  LinkOutcome,
  ResolvableLink,
  VisitorContext,
} from '@/domain/utils/matching/link-resolver'
import type { Context, Hono } from 'hono'

/** The fixed, non-configurable base path. */
const LINK_PREFIX = '/l/'
const SVG_SUFFIX = '.svg'

/**
 * Split `/l/{token}` into the slug it names and which variant was asked for.
 *
 * The slug charset forbids `.`, so the suffix test is an EXACT discriminator
 * rather than a heuristic — there is no slug for which this split is wrong.
 */
const splitSvgVariant = (raw: string): { readonly slug: string; readonly isSvg: boolean } => {
  const isSvg = raw.endsWith(SVG_SUFFIX)
  return { slug: isSvg ? raw.slice(0, -SVG_SUFFIX.length) : raw, isSvg }
}

/** The one canonical address for a slug, preserving the variant asked for. */
const canonicalPath = (slug: string, isSvg: boolean): string =>
  `${LINK_PREFIX}${slug.toLowerCase()}${isSvg ? SVG_SUFFIX : ''}`

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
const countClicks = async (appName: string, slug: string): Promise<number> => {
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

  return Effect.runPromise(provideAnalyticsLive(program).pipe(Effect.orElseSucceed(() => 0)))
}

/**
 * The click count the resolver needs — counted only when a cap exists.
 *
 * A link with no `maxClicks` can never be exhausted, so querying the analytics
 * store for it would be a per-redirect round trip bought for nothing.
 */
const creditedClicks = async (
  appName: string,
  link: ResolvableLink,
  slug: string
): Promise<number> => (link.lifecycle?.maxClicks === undefined ? 0 : countClicks(appName, slug))

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
const recordClick = (
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
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
    const visitorHash = yield* Effect.promise(() =>
      computeVisitorHash(getRequestClientIp(c), userAgent, app.name)
    )
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

  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget by design: the redirect must not wait on (or fail with) the analytics write. `ignoreVoid` does not cover the `void` operator, so the suppression is the only lever; same idiom as analytics.ts.
  void Effect.runPromise(provideAnalyticsLive(program).pipe(Effect.ignore))
}

/** The absolute address this link is served at, for QR encoding. */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
const absoluteShortUrl = (c: Context, slug: string): string => {
  const url = new URL(c.req.url)
  return `${url.origin}${LINK_PREFIX}${slug}?${QR_MARKER_PARAM}=1`
}

/**
 * Answer the `.svg` variant for an already-resolved link.
 *
 * Split out of the handler so the redirect path reads as one straight line. A
 * render is not a scan, so nothing is recorded here — but the QR endpoint still
 * agrees with the redirect endpoint about LIVENESS, because printing a code for
 * a link that no longer resolves is the worst outcome available: it fails in the
 * field, months later, where nobody can fix it.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
const respondWithQr = (c: Context, outcome: LinkOutcome, slug: string): Response => {
  // eslint-disable-next-line unicorn/no-null -- Hono's empty-body idiom; see analytics.ts
  if (outcome.kind === 'gone') return c.body(null, 410)

  // `encodeQrSvg` returns a result rather than throwing (the domain layer is
  // throw-free); its only failure is a payload past version-40 capacity, which a
  // short URL cannot reach — so it is a 500, not a shaped error.
  const svg = encodeQrSvg(absoluteShortUrl(c, slug))
  if (!svg.ok) return c.text(svg.error.message, 500)

  return c.body(svg.value, 200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
}

/**
 * Answer a link that no longer resolves.
 *
 * 410 Gone, not 404 — the URL genuinely did exist, and 410 tells a crawler to
 * drop it and a human that it expired rather than that they mistyped. A link
 * declaring `expiredTo` redirects there instead, which is the only way an
 * operator has to retire an address that is already in print.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
const respondGone = (c: Context, outcome: { readonly location?: string }): Response =>
  outcome.location === undefined
    ? // eslint-disable-next-line unicorn/no-null -- Hono's empty-body idiom; see analytics.ts
      c.body(null, 410)
    : c.redirect(outcome.location, 302)

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
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
const visitorContext = (c: Context): VisitorContext => {
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

/**
 * The plaintext a gated link expects, resolved from `$env.`.
 *
 * The schema refuses a literal, so `link.password` is always a reference and
 * this is the only place the secret exists. Returns `undefined` when the link is
 * not gated; an EMPTY string when the variable is declared but unset, which
 * keeps the gate closed rather than accidentally opening it to everyone who
 * submits an empty form (`verifyPassword` rejects an empty expected value).
 */
const gatePassword = (app: App, link: ResolvableLink): string | undefined =>
  link.password === undefined
    ? undefined
    : resolveEnvInString(link.password, buildEnvLookup(app.env, process.env))

/**
 * Whether the visitor supplied the right password.
 *
 * Length-independent comparison is not attempted: this is a shared link
 * password, not a per-user credential, and the rate limiting that would make a
 * timing attack the cheapest avenue does not exist here. What DOES matter is
 * that an unset variable never opens the gate.
 */
const verifyPassword = (expected: string | undefined, supplied: string | undefined): boolean =>
  expected !== undefined && expected !== '' && supplied === expected

/** The password field of a submitted gate form, if any. */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
const submittedPassword = async (c: Context): Promise<string | undefined> => {
  if (c.req.method !== 'POST') return undefined
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
  const value = (body as Record<string, unknown>)['password']
  return typeof value === 'string' ? value : undefined
}

/** A resolvable definition plus the console overlay that may veto it. */
interface ResolvedDefinition {
  readonly link: ResolvableLink
  readonly overlayDisabled: boolean
}

/** Shared `gone` outcome for the overlay veto — the QR path needs one too. */
const GONE: Extract<LinkOutcome, { readonly kind: 'gone' }> = { kind: 'gone' }

/** Translate a stored row into the shape the resolver already understands. */
const storedToResolvable = (row: LinkRecord): ResolvableLink => ({
  slug: row.slug,
  ...(row.destination === null ? {} : { to: row.destination }),
  ...(row.targets === null ? {} : { targets: row.targets }),
  lifecycle: {
    enabled: row.enabled,
    ...(row.validFrom === null ? {} : { validFrom: row.validFrom }),
    ...(row.validUntil === null ? {} : { validUntil: row.validUntil }),
    ...(row.maxClicks === null ? {} : { maxClicks: row.maxClicks }),
    ...(row.expiredTo === null ? {} : { expiredTo: row.expiredTo }),
  },
  ...(row.utm === null ? {} : { utm: row.utm }),
})

/**
 * Find the definition for a slug across BOTH populations.
 *
 * Config wins outright: a slug declared in `app.links[]` resolves from the file
 * and the stored row (if any) contributes only its `disabled_at` overlay. That
 * ordering is what makes the boot shadow sweep's bookkeeping true rather than
 * decorative — the sweep stamps rows the config has claimed precisely because
 * this function has stopped reading them.
 *
 * The DB is consulted ONLY on a config miss, so an app whose links are entirely
 * config-declared pays no query per redirect.
 */
const resolveDeclaredOrStored = async (
  app: App,
  declared: ResolvableLink | undefined,
  slug: string
): Promise<ResolvedDefinition | undefined> => {
  const program = Effect.gen(function* () {
    const repository = yield* LinkRepository
    return yield* repository.findBySlug({ appName: app.name, slug })
  })

  const row = await Effect.runPromise(
    program.pipe(
      Effect.provide(LinkRepositoryLive.pipe(Layer.provide(DatabaseLive))),
      // A database that cannot answer must not take the config links down with
      // it: a config-declared link is fully resolvable from memory, so the
      // failure degrades the overlay, not the redirect.
      Effect.orElseSucceed(() => undefined)
    )
  )

  const overlayDisabled = row?.disabledAt !== null && row?.disabledAt !== undefined

  if (declared !== undefined) return { link: declared, overlayDisabled }
  if (row === undefined || row.shadowedAt !== null) return undefined
  return { link: storedToResolvable(row), overlayDisabled }
}

/**
 * Setup the `app.links` routing.
 *
 * @param honoApp - Hono application instance.
 * @param app - Decoded app configuration.
 * @returns The Hono app with the link routes chained.
 */
export function setupLinkRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  // Registered UNCONDITIONALLY, even when `app.links` is empty. Links can be
  // minted from the console into `system.links` on an app whose config declares
  // none, and an early return here would leave `/l/*` unrouted for exactly that
  // app — the operator would create a link, get a 201, and watch it 404.
  const bySlug = new Map((app.links ?? []).map((link) => [link.slug, link]))

  /**
   * One handler for GET and POST alike.
   *
   * The POST exists only so a gate form has somewhere to submit to, and it must
   * resolve the link by exactly the same rules the GET does — a second lookup
   * path is how a gated link ends up honouring a lifecycle window on one verb
   * and not the other.
   */
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  const handle = async (c: Context): Promise<Response> => {
    const { slug: token, isSvg } = splitSvgVariant(c.req.param('token') ?? '')

    // ONE canonical address per link. The slug is the analytics join key, so two
    // spellings would split one campaign across two rows — and the address gets
    // printed, where a reader's capitalisation is not under anyone's control.
    if (token !== token.toLowerCase()) return c.redirect(canonicalPath(token, isSvg), 301)

    const resolved = await resolveDeclaredOrStored(app, bySlug.get(token), token)
    if (resolved === undefined) return c.notFound()
    const { link, overlayDisabled } = resolved

    // The console's overlay may only ever be MORE restrictive than the file
    // ([internal ref] D3), so it is applied as a floor over whatever the definition
    // says rather than merged into it — an operator killing a link during an
    // incident must not be able to bring back one the config has switched off.
    if (overlayDisabled) return isSvg ? respondWithQr(c, GONE, token) : respondGone(c, GONE)

    const supplied = await submittedPassword(c)
    const outcome = resolveLinkOutcome(link, {
      now: new Date(),
      clickCount: await creditedClicks(app.name, link, token),
      requestSearch: requestSearch(c),
      draw: Math.random(),
      visitor: visitorContext(c),
      passwordSatisfied: verifyPassword(gatePassword(app, link), supplied),
    })

    // A QR code encodes the link's ADDRESS, not its destination, so a gate is
    // irrelevant to it — the visitor meets the gate when they follow the code.
    if (isSvg) return respondWithQr(c, outcome, token)
    if (outcome.kind === 'gone') return respondGone(c, outcome)
    if (outcome.kind === 'gated') {
      // `no-store` for the same reason the redirect carries it, and one more:
      // a cached interstitial would keep prompting after the gate was removed.
      c.header('Cache-Control', 'no-store')
      return c.html(renderLinkGatePage(token, supplied !== undefined), 200)
    }

    recordClick(c, app, {
      slug: token,
      destination: outcome.location,
      targetIndex: outcome.targetIndex,
      isScan: new URLSearchParams(requestSearch(c)).get(QR_MARKER_PARAM) !== null,
    })

    // `no-store` is the header that makes the whole feature honest: a cached
    // redirect would keep sending visitors to a destination after it was
    // re-pointed, and would silently defeat both `maxClicks` and `validUntil`
    // because the browser would never ask again.
    c.header('Cache-Control', 'no-store')
    return c.redirect(outcome.location, 302)
  }

  return honoApp.get('/l/:token', handle).post('/l/:token', handle)
}
