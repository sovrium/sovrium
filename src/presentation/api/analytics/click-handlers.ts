/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/analytics/click` — a click on an outbound anchor in a rendered page.
 *
 * A SIBLING of `handleCollect`, not an overload of it. The deployed
 * `/assets/analytics.js` speaks a terse one-letter page-view contract, and
 * widening that payload with a discriminant would change the meaning of a body
 * already in flight: a browser holding a cached copy of the old script keeps
 * sending the old shape for as long as its cache lives.
 *
 * SAME FIVE STEPS, deliberately — excluded-path → DNT → fire-and-forget → 204.
 * The privacy gating is identical to every other event, and the exclusion is
 * applied to the PAGE the click happened on rather than the destination: an
 * operator excluding a page means "do not measure activity here", and a click is
 * activity here.
 *
 * Nothing is awaited and nothing can fail the response. A visitor who has asked
 * not to be tracked, or whose event cannot be written, still follows the link —
 * declining to be measured is not declining to be served.
 *
 * A sibling MODULE rather than a second handler in `analytics.ts` for the same
 * reason `targets-handler.ts` is one: that file is already at its line budget,
 * and a handler that shares nothing with the five readers around it does not
 * earn a place among them.
 */

import { Effect } from 'effect'
import { collectOutboundClick } from '@/application/use-cases/analytics/collect-outbound-click'
import { matchesAnyGlobPattern } from '@/domain/kernel/matching/glob-matcher'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import type { AnalyticsClickPayload } from '@/domain/models/api/analytics/analytics'
import type { ValidatedContext } from '@/presentation/api/runtime/effect-validator'

/** The slice of the analytics route config this handler reads. */
export interface ClickHandlerConfig {
  readonly appName: string
  readonly excludedPaths?: readonly string[]
  readonly respectDoNotTrack?: boolean
}

/** Record one outbound click, or decline to, and answer 204 either way. */
export function handleClick(
  c: ValidatedContext<'json', AnalyticsClickPayload>,
  config: ClickHandlerConfig
): Response {
  const body = c.req.valid('json')

  const noContent = (): Response => c.body(null, 204)

  if (matchesAnyGlobPattern(config.excludedPaths, body.pagePath)) return noContent()
  if (config.respectDoNotTrack === true && c.req.header('DNT') === '1') return noContent()

  void Effect.runPromise(
    provideDomain(
      c,
      collectOutboundClick({
        appName: config.appName,
        href: body.href,
        hostname: body.hostname,
        pagePath: body.pagePath,
        ip: getRequestClientIp(c),
        userAgent: c.req.header('user-agent') ?? '',
        timeZone: resolveOperatorTimezone(),
      })
    ).pipe(
      // effect-swallow: an outbound-click beacon. The visitor has already left for the destination, so there is nobody to report a failure to, and the endpoint answers 204 either way.
      Effect.ignore
    )
  )

  return noContent()
}
