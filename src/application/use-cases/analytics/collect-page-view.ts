/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { withoutQuery } from '@/domain/models/app/analytics/analytics-profile-service'
import { AnalyticsRepository } from '../../ports/repositories/analytics/analytics-repository'
import { parseUserAgent } from './ua-parser'
import { visitorIdentifiers } from './visitor-hash'
import type { AnalyticsDatabaseError } from '../../ports/repositories/analytics/analytics-repository'
import type { VisitorSecret } from '../../ports/services/visitor-secret'
import type { AnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'

/**
 * Input for collecting a page view event
 */
export interface CollectPageViewInput {
  readonly appName: string
  readonly pagePath: string
  readonly pageTitle?: string
  readonly referrerUrl?: string
  readonly utmSource?: string
  readonly utmMedium?: string
  readonly utmCampaign?: string
  readonly utmContent?: string
  readonly utmTerm?: string
  readonly screenWidth?: number
  readonly screenHeight?: number
  readonly ip: string
  readonly userAgent: string
  /** IANA zone whose calendar day rotates the visitor identifier (the operator timezone). */
  readonly timeZone: string
  readonly acceptLanguage?: string
  readonly sessionTimeoutMinutes?: number
  /** Which fields the row keeps: `audience-only` drops everything the visitor's browser sent beyond the page. */
  readonly profile: AnalyticsProfile
}

/**
 * Extract the primary language from Accept-Language header.
 *
 * @example "en-US,en;q=0.9,fr;q=0.8" → "en-US"
 */
const extractLanguage = (header: string | undefined): string | undefined => {
  if (!header) return undefined
  const first = header.split(',')[0]
  if (!first) return undefined
  return first.split(';')[0]?.trim()
}

/**
 * Extract domain from a referrer URL.
 *
 * @example "https://www.google.com/search?q=test" → "google.com"
 */
const extractReferrerDomain = (referrerUrl: string | undefined): string | undefined => {
  if (!referrerUrl) return undefined
  try {
    const url = new URL(referrerUrl)
    // Strip 'www.' prefix for cleaner domain names
    return url.hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/**
 * Collect a page view event.
 *
 * Orchestrates visitor hashing, UA parsing, referrer extraction,
 * and persists the page view to the analytics repository.
 *
 * This is an Effect program requiring the AnalyticsRepository service.
 */
export const collectPageView = (
  input: CollectPageViewInput
): Effect.Effect<void, AnalyticsDatabaseError, AnalyticsRepository | VisitorSecret> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const { visitorHash, sessionHash } = yield* visitorIdentifiers({
      address: input.ip,
      userAgent: input.userAgent,
      timeZone: input.timeZone,
      sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? 30,
      profile: input.profile,
    })

    // Parse device information from User-Agent
    const { deviceType, browserName, osName } = parseUserAgent(input.userAgent)

    // Extract language and referrer domain
    const language = extractLanguage(input.acceptLanguage)
    const referrerDomain = extractReferrerDomain(input.referrerUrl)

    // Under `audience-only` the server drops what the tracker sent beyond the
    // page, the referring host and the device, whatever the tracker sent.
    const full = input.profile === 'full'
    yield* repo.recordPageView({
      appName: input.appName,
      pagePath: full ? input.pagePath : withoutQuery(input.pagePath),
      visitorHash,
      sessionHash,
      isEntrance: false, // TODO: detect entrance based on session history
      referrerDomain,
      deviceType,
      browserName,
      osName,
      language,
      ...(full
        ? {
            pageTitle: input.pageTitle,
            referrerUrl: input.referrerUrl,
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
            utmContent: input.utmContent,
            utmTerm: input.utmTerm,
            screenWidth: input.screenWidth,
            screenHeight: input.screenHeight,
          }
        : {}),
    })
  }).pipe(Effect.withSpan('analytics.collect-page-view'))
