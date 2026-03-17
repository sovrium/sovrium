/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

// ============================================================================
// Port-level types (avoid infrastructure dependency)
// ============================================================================

/**
 * Page view input for recording a new event
 */
export interface PageViewInput {
  readonly appName: string
  readonly pagePath: string
  readonly pageTitle?: string
  readonly visitorHash: string
  readonly sessionHash: string
  readonly isEntrance: boolean
  readonly referrerUrl?: string
  readonly referrerDomain?: string
  readonly utmSource?: string
  readonly utmMedium?: string
  readonly utmCampaign?: string
  readonly utmContent?: string
  readonly utmTerm?: string
  readonly deviceType?: string
  readonly browserName?: string
  readonly osName?: string
  readonly language?: string
  readonly screenWidth?: number
  readonly screenHeight?: number
}

/**
 * Query parameters for analytics data retrieval
 */
export interface AnalyticsQueryParams {
  readonly appName: string
  readonly from: Date
  readonly to: Date
  readonly granularity: 'hour' | 'day' | 'week' | 'month'
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  readonly period: string
  readonly pageViews: number
  readonly uniqueVisitors: number
  readonly sessions: number
}

/**
 * Summary metrics
 */
export interface AnalyticsSummary {
  readonly pageViews: number
  readonly uniqueVisitors: number
  readonly sessions: number
}

/**
 * Top page entry
 */
export interface TopPage {
  readonly path: string
  readonly pageViews: number
  readonly uniqueVisitors: number
}

/**
 * Top referrer entry
 */
export interface TopReferrer {
  readonly domain: string | null
  readonly pageViews: number
  readonly uniqueVisitors: number
}

/**
 * Breakdown entry (device type, browser, OS)
 */
export interface BreakdownEntry {
  readonly name: string
  readonly count: number
  readonly percentage: number
}

/**
 * Device breakdown result
 */
export interface DeviceBreakdown {
  readonly deviceTypes: readonly BreakdownEntry[]
  readonly browsers: readonly BreakdownEntry[]
  readonly operatingSystems: readonly BreakdownEntry[]
}

/**
 * Campaign entry
 */
export interface CampaignEntry {
  readonly source: string | null
  readonly medium: string | null
  readonly campaign: string | null
  readonly pageViews: number
  readonly uniqueVisitors: number
}

// ============================================================================
// Error type
// ============================================================================

/**
 * Database error for analytics operations
 */
export class AnalyticsDatabaseError extends Data.TaggedError('AnalyticsDatabaseError')<{
  readonly cause: unknown
}> {}

// ============================================================================
// Repository port
// ============================================================================

/**
 * Analytics Repository Port
 *
 * Provides type-safe database operations for analytics page views.
 * Implementation lives in infrastructure layer (analytics-repository-live.ts).
 */
export class AnalyticsRepository extends Context.Tag('AnalyticsRepository')<
  AnalyticsRepository,
  {
    readonly recordPageView: (input: PageViewInput) => Effect.Effect<void, AnalyticsDatabaseError>
    readonly getTimeSeries: (
      params: AnalyticsQueryParams
    ) => Effect.Effect<readonly TimeSeriesPoint[], AnalyticsDatabaseError>
    readonly getSummary: (
      params: AnalyticsQueryParams
    ) => Effect.Effect<AnalyticsSummary, AnalyticsDatabaseError>
    readonly getTopPages: (
      params: AnalyticsQueryParams
    ) => Effect.Effect<readonly TopPage[], AnalyticsDatabaseError>
    readonly getTopReferrers: (
      params: AnalyticsQueryParams
    ) => Effect.Effect<readonly TopReferrer[], AnalyticsDatabaseError>
    readonly getDevices: (
      params: AnalyticsQueryParams
    ) => Effect.Effect<DeviceBreakdown, AnalyticsDatabaseError>
    readonly getCampaigns: (
      params: AnalyticsQueryParams
    ) => Effect.Effect<readonly CampaignEntry[], AnalyticsDatabaseError>
    readonly deleteOlderThan: (
      appName: string,
      cutoff: Date
    ) => Effect.Effect<number, AnalyticsDatabaseError>
  }
>() {}
