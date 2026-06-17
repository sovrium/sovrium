/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


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

export interface RecordEventInput {
  readonly appName: string
  readonly eventType: string
  readonly eventName?: string
  readonly orgId?: string
  readonly visitorHash: string
  readonly sessionHash: string
  readonly properties?: Record<string, unknown>
}

export interface ListEventsParams {
  readonly appName: string
  readonly eventType?: string
  readonly eventName?: string
  readonly limit?: number
  readonly offset?: number
  readonly from?: Date
  readonly to?: Date
}

export interface AnalyticsEventRow {
  readonly id: string
  readonly appName: string
  readonly eventType: string
  readonly eventName: string | null
  readonly orgId: string | null
  readonly visitorHash: string
  readonly sessionHash: string
  readonly timestamp: Date
  readonly properties: Record<string, unknown>
}

export interface AnalyticsQueryParams {
  readonly appName: string
  readonly from: Date
  readonly to: Date
  readonly granularity: 'hour' | 'day' | 'week' | 'month'
}

export interface TimeSeriesPoint {
  readonly period: string
  readonly pageViews: number
  readonly uniqueVisitors: number
  readonly sessions: number
}

export interface AnalyticsSummary {
  readonly pageViews: number
  readonly uniqueVisitors: number
  readonly sessions: number
}

export interface TopPage {
  readonly path: string
  readonly pageViews: number
  readonly uniqueVisitors: number
}

export interface TopReferrer {
  readonly domain: string | null
  readonly pageViews: number
  readonly uniqueVisitors: number
}

export interface BreakdownEntry {
  readonly name: string
  readonly count: number
  readonly percentage: number
}

export interface DeviceBreakdown {
  readonly deviceTypes: readonly BreakdownEntry[]
  readonly browsers: readonly BreakdownEntry[]
  readonly operatingSystems: readonly BreakdownEntry[]
}

export interface CampaignEntry {
  readonly source: string | null
  readonly medium: string | null
  readonly campaign: string | null
  readonly pageViews: number
  readonly uniqueVisitors: number
}


export class AnalyticsDatabaseError extends Data.TaggedError('AnalyticsDatabaseError')<{
  readonly cause: unknown
}> {}


export class AnalyticsRepository extends Context.Tag('AnalyticsRepository')<
  AnalyticsRepository,
  {
    readonly recordPageView: (input: PageViewInput) => Effect.Effect<void, AnalyticsDatabaseError>
    readonly recordEvent: (input: RecordEventInput) => Effect.Effect<void, AnalyticsDatabaseError>
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
    readonly listEvents: (params: ListEventsParams) => Effect.Effect<
      {
        readonly events: readonly AnalyticsEventRow[]
        readonly pagination: {
          readonly total: number
          readonly limit: number
          readonly offset: number
          readonly hasMore: boolean
        }
      },
      AnalyticsDatabaseError
    >
  }
>() {}
