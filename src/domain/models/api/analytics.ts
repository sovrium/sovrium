/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ============================================================================
// Collection Schema (POST /api/analytics/collect)
// ============================================================================

/**
 * Analytics collection payload schema
 *
 * Minimal payload sent by the tracking script.
 * Single-letter keys to minimize bandwidth usage.
 */
export const analyticsCollectSchema = z.object({
  /** Page path (required) */
  p: z.string().min(1).describe('Page path being viewed'),
  /** Page title (optional) */
  t: z.string().optional().describe('Page title'),
  /** Referrer URL (optional) */
  r: z.string().optional().describe('Full referrer URL'),
  /** Screen width (optional) */
  sw: z.number().int().positive().optional().describe('Screen width in pixels'),
  /** Screen height (optional) */
  sh: z.number().int().positive().optional().describe('Screen height in pixels'),
  /** UTM source (optional) */
  us: z.string().optional().describe('UTM source parameter'),
  /** UTM medium (optional) */
  um: z.string().optional().describe('UTM medium parameter'),
  /** UTM campaign (optional) */
  uc: z.string().optional().describe('UTM campaign parameter'),
  /** UTM content (optional) */
  ux: z.string().optional().describe('UTM content parameter'),
  /** UTM term (optional) */
  ut: z.string().optional().describe('UTM term parameter'),
})

export type AnalyticsCollectPayload = z.infer<typeof analyticsCollectSchema>

// ============================================================================
// Query Parameters Schema (shared across query endpoints)
// ============================================================================

/**
 * Analytics query parameters schema
 *
 * Shared query parameters for all analytics query endpoints.
 */
export const analyticsQuerySchema = z.object({
  /** Start of date range (ISO 8601) */
  from: z.string().describe('Start of date range (ISO 8601 datetime)'),
  /** End of date range (ISO 8601) */
  to: z.string().describe('End of date range (ISO 8601 datetime)'),
  /** Time series granularity */
  granularity: z
    .enum(['hour', 'day', 'week', 'month'])
    .default('day')
    .describe('Time series granularity'),
})

export type AnalyticsQueryParams = z.infer<typeof analyticsQuerySchema>

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Time series data point
 */
export const timeSeriesPointSchema = z.object({
  period: z.string().describe('Time period start (ISO 8601)'),
  pageViews: z.number().int().describe('Total page views in period'),
  uniqueVisitors: z.number().int().describe('Unique visitors in period'),
  sessions: z.number().int().describe('Unique sessions in period'),
})

export type TimeSeriesPoint = z.infer<typeof timeSeriesPointSchema>

/**
 * Analytics overview response schema
 *
 * GET /api/analytics/overview
 */
export const analyticsOverviewResponseSchema = z.object({
  summary: z.object({
    pageViews: z.number().int().describe('Total page views'),
    uniqueVisitors: z.number().int().describe('Total unique visitors'),
    sessions: z.number().int().describe('Total sessions'),
  }),
  timeSeries: z.array(timeSeriesPointSchema).describe('Time series data points'),
})

export type AnalyticsOverviewResponse = z.infer<typeof analyticsOverviewResponseSchema>

/**
 * Top pages response schema
 *
 * GET /api/analytics/pages
 */
export const analyticsTopPagesResponseSchema = z.object({
  pages: z.array(
    z.object({
      path: z.string().describe('Page path'),
      pageViews: z.number().int().describe('Total page views'),
      uniqueVisitors: z.number().int().describe('Unique visitors'),
    })
  ),
  total: z.number().int().describe('Total number of pages'),
})

export type AnalyticsTopPagesResponse = z.infer<typeof analyticsTopPagesResponseSchema>

/**
 * Top referrers response schema
 *
 * GET /api/analytics/referrers
 */
export const analyticsTopReferrersResponseSchema = z.object({
  referrers: z.array(
    z.object({
      domain: z.string().nullable().describe('Referrer domain (null for direct traffic)'),
      pageViews: z.number().int().describe('Total page views from this referrer'),
      uniqueVisitors: z.number().int().describe('Unique visitors from this referrer'),
    })
  ),
  total: z.number().int().describe('Total referrer entries'),
})

export type AnalyticsTopReferrersResponse = z.infer<typeof analyticsTopReferrersResponseSchema>

/**
 * Device breakdown entry schema
 */
const breakdownEntrySchema = z.object({
  name: z.string().describe('Category name'),
  count: z.number().int().describe('Number of page views'),
  percentage: z.number().describe('Percentage of total (0-100)'),
})

/**
 * Device breakdown response schema
 *
 * GET /api/analytics/devices
 */
export const analyticsDevicesResponseSchema = z.object({
  deviceTypes: z.array(breakdownEntrySchema).describe('Device type breakdown'),
  browsers: z.array(breakdownEntrySchema).describe('Browser name breakdown'),
  operatingSystems: z.array(breakdownEntrySchema).describe('OS name breakdown'),
})

export type AnalyticsDevicesResponse = z.infer<typeof analyticsDevicesResponseSchema>

/**
 * Campaign entry schema
 */
const campaignEntrySchema = z.object({
  source: z.string().nullable().describe('UTM source'),
  medium: z.string().nullable().describe('UTM medium'),
  campaign: z.string().nullable().describe('UTM campaign'),
  pageViews: z.number().int().describe('Total page views'),
  uniqueVisitors: z.number().int().describe('Unique visitors'),
})

/**
 * Campaigns response schema
 *
 * GET /api/analytics/campaigns
 */
export const analyticsCampaignsResponseSchema = z.object({
  campaigns: z.array(campaignEntrySchema).describe('UTM campaign breakdown'),
  total: z.number().int().describe('Total campaign entries'),
})

export type AnalyticsCampaignsResponse = z.infer<typeof analyticsCampaignsResponseSchema>
