/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics/analytics-repository'
import { parseUserAgent } from './ua-parser'
import { computeSessionHash, computeVisitorHash } from './visitor-hash'
import type { AnalyticsDatabaseError } from '../../ports/repositories/analytics/analytics-repository'

/** Input for recording a click on an outbound anchor in a rendered page. */
export interface CollectOutboundClickInput {
  readonly appName: string
  /** Absolute destination URL of the clicked anchor. */
  readonly href: string
  /** Destination hostname — becomes the event NAME. */
  readonly hostname: string
  /** The page the click happened on, not the destination. */
  readonly pagePath: string
  readonly ip: string
  readonly userAgent: string
  readonly sessionTimeoutMinutes?: number
}

/**
 * Record one `outbound_click`.
 *
 * A new `event_type` value in the existing `system.analytics_events` — no DDL,
 * no second table, no counter column ([internal ref] D6). Every reader that
 * already aggregates `link_click` reads this population for free.
 *
 * `event_name` is the destination HOSTNAME rather than the full href, because
 * the hostname is the natural grouping key: "which partners do people actually
 * click?" is then answerable through the existing events reader without
 * extracting anything out of JSONB. The full `href` is kept in `properties` for
 * the follow-up question.
 *
 * Property keys deliberately mirror a page view's (`deviceType`, `browserName`,
 * `osName`, `pagePath`), which is what lets the reused analytics readers
 * aggregate clicks with no per-type mapping layer.
 */
export const collectOutboundClick = (
  input: CollectOutboundClickInput
): Effect.Effect<void, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    // effect-promise: total -- the hash helper wraps `crypto.subtle.digest('SHA-256', …)` over a `TextEncoder` result; SHA-256 is always available and the input is always a valid BufferSource, so the digest has no rejection path.
    const visitorHash = yield* Effect.promise(() =>
      computeVisitorHash(input.ip, input.userAgent, input.appName)
    )
    // effect-promise: total -- the hash helper wraps `crypto.subtle.digest('SHA-256', …)` over a `TextEncoder` result; SHA-256 is always available and the input is always a valid BufferSource, so the digest has no rejection path.
    const sessionHash = yield* Effect.promise(() =>
      computeSessionHash(visitorHash, input.sessionTimeoutMinutes ?? 30)
    )
    const { deviceType, browserName, osName } = parseUserAgent(input.userAgent)

    yield* repo.recordEvent({
      appName: input.appName,
      eventType: 'outbound_click',
      eventName: input.hostname,
      visitorHash,
      sessionHash,
      properties: {
        href: input.href,
        hostname: input.hostname,
        pagePath: input.pagePath,
        deviceType,
        browserName,
        osName,
      },
    })
  }).pipe(Effect.withSpan('analytics.collect-outbound-click'))
