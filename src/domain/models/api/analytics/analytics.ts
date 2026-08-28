/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

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
// Outbound Click Collection Schema
// ============================================================================

/**
 * The body `POST /api/analytics/click` accepts — an on-page click on an anchor
 * pointing off-site.
 *
 * A SIBLING contract, not an extension of `analyticsCollectSchema`. The
 * page-view body is terse one-letter keys, and adding a discriminant to it would
 * change the meaning of a body already in flight from browsers running a
 * previously-cached `/assets/analytics.js`. Full names here because the contract
 * is new, an outbound click is rare compared with a page view, and a readable
 * body is worth twenty bytes on it.
 *
 * `pagePath` is the page the click HAPPENED on, not the destination: an operator
 * excluding a page means "do not measure activity here", and a click is activity
 * here.
 */
export const analyticsClickSchema = z.object({
  /** Absolute destination URL of the clicked anchor */
  href: z.string().min(1).describe('Absolute destination URL of the clicked anchor'),
  /** Destination hostname — recorded as the event name so grouping needs no extraction */
  hostname: z.string().min(1).describe('Destination hostname — recorded as the event name'),
  /** Path of the page the click happened on */
  pagePath: z.string().min(1).describe('Path of the page the click happened on'),
})

export type AnalyticsClickPayload = z.infer<typeof analyticsClickSchema>

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
export const timeSeriesPointSchema = z
  .object({
    period: z.string().describe('Time period start (ISO 8601)'),
    pageViews: z.number().int().describe('Total page views in period'),
    uniqueVisitors: z.number().int().describe('Unique visitors in period'),
    sessions: z.number().int().describe('Unique sessions in period'),
  })
  .openapi('TimeSeriesPoint')

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
 * Target-split response schema
 *
 * GET /api/analytics/targets
 *
 * A SIBLING of `/devices` and `/campaigns` in the same reader family, not a new
 * aggregation path — which is why it lives here rather than under
 * `/api/admin/links/:slug/variants`.
 *
 * The distinction matters and is easy to get wrong: cloning an aggregation the
 * store already computes is duplication, and every such clone was cut from this
 * feature's design. Adding a DIMENSION to the one pipeline is not — `targetIndex`
 * is a JSONB property exactly like `deviceType`, read with the same
 * `jsonExtractPath`, gated by the same parameterised where-clause, and shaped
 * into the same `{ name, count, percentage }` entries. A `/variants` endpoint
 * under the admin namespace would have been a second path to the same rows.
 *
 * Narrowed by `?event_type=link_click&event_name={slug}` like every other reader,
 * so it answers "how did this link's targets split?" without knowing what a link is.
 */
export const analyticsTargetsResponseSchema = z.object({
  targets: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "The target's index as recorded on the click event, stringified — `targetIndex` is written from the first click of every link, including single-destination ones, so a split is readable back through data that predates the experiment."
          ),
        count: z.number().int().describe('Clicks attributed to this target'),
        percentage: z.number().describe('Share of this link’s clicks (0-100)'),
        destination: z
          .string()
          .nullable()
          .describe(
            'The destination that index currently resolves to, or null when the link has since been re-pointed and the index no longer maps. Null rather than omitted, so a stale split still renders a row instead of silently losing its clicks.'
          ),
      })
    )
    .describe('Per-target click split for one link'),
  total: z.number().int().describe('Total clicks across all targets in the window'),
})

/**
 * @public
 */
export type AnalyticsTargetsResponse = z.infer<typeof analyticsTargetsResponseSchema>

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
