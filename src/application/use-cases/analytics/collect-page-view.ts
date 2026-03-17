/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import { parseUserAgent } from './ua-parser'
import { computeSessionHash, computeVisitorHash } from './visitor-hash'
import type { AnalyticsDatabaseError } from '../../ports/repositories/analytics-repository'

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
  readonly acceptLanguage?: string
  readonly sessionTimeoutMinutes?: number
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
): Effect.Effect<void, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    // Compute privacy-safe visitor and session hashes
    const visitorHash = yield* Effect.promise(() =>
      computeVisitorHash(input.ip, input.userAgent, input.appName)
    )
    const sessionHash = yield* Effect.promise(() =>
      computeSessionHash(visitorHash, input.sessionTimeoutMinutes ?? 30)
    )

    // Parse device information from User-Agent
    const { deviceType, browserName, osName } = parseUserAgent(input.userAgent)

    // Extract language and referrer domain
    const language = extractLanguage(input.acceptLanguage)
    const referrerDomain = extractReferrerDomain(input.referrerUrl)

    // Record the page view
    yield* repo.recordPageView({
      appName: input.appName,
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      visitorHash,
      sessionHash,
      isEntrance: false, // TODO: detect entrance based on session history
      referrerUrl: input.referrerUrl,
      referrerDomain,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
      utmTerm: input.utmTerm,
      deviceType,
      browserName,
      osName,
      language,
      screenWidth: input.screenWidth,
      screenHeight: input.screenHeight,
    })
  })
