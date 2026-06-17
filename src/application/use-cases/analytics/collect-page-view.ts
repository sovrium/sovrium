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

const extractLanguage = (header: string | undefined): string | undefined => {
  if (!header) return undefined
  const first = header.split(',')[0]
  if (!first) return undefined
  return first.split(';')[0]?.trim()
}

const extractReferrerDomain = (referrerUrl: string | undefined): string | undefined => {
  if (!referrerUrl) return undefined
  try {
    const url = new URL(referrerUrl)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export const collectPageView = (
  input: CollectPageViewInput
): Effect.Effect<void, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const visitorHash = yield* Effect.promise(() =>
      computeVisitorHash(input.ip, input.userAgent, input.appName)
    )
    const sessionHash = yield* Effect.promise(() =>
      computeSessionHash(visitorHash, input.sessionTimeoutMinutes ?? 30)
    )

    const { deviceType, browserName, osName } = parseUserAgent(input.userAgent)

    const language = extractLanguage(input.acceptLanguage)
    const referrerDomain = extractReferrerDomain(input.referrerUrl)

    yield* repo.recordPageView({
      appName: input.appName,
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      visitorHash,
      sessionHash,
      isEntrance: false,
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
