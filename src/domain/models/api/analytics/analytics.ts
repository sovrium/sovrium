/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { withDefault } from '../combinators/schema-defaults'

// ============================================================================
// Collection Schema (POST /api/analytics/collect)
// ============================================================================

/**
 * Analytics collection payload schema
 *
 * Minimal payload sent by the tracking script.
 * Single-letter keys to minimize bandwidth usage.
 */
export const analyticsCollectSchema = Schema.Struct({
  /** Page path (required) */
  p: Schema.String.annotate({ description: 'Page path being viewed' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  /** Page title (optional) */
  t: optionalField(Schema.String.annotate({ description: 'Page title' })),
  /** Referrer URL (optional) */
  r: optionalField(Schema.String.annotate({ description: 'Full referrer URL' })),
  /** Screen width (optional) */
  sw: optionalField(
    Schema.Int.annotate({ description: 'Screen width in pixels' }).pipe(
      Schema.check(Schema.isGreaterThan(0))
    )
  ),
  /** Screen height (optional) */
  sh: optionalField(
    Schema.Int.annotate({ description: 'Screen height in pixels' }).pipe(
      Schema.check(Schema.isGreaterThan(0))
    )
  ),
  /** UTM source (optional) */
  us: optionalField(Schema.String.annotate({ description: 'UTM source parameter' })),
  /** UTM medium (optional) */
  um: optionalField(Schema.String.annotate({ description: 'UTM medium parameter' })),
  /** UTM campaign (optional) */
  uc: optionalField(Schema.String.annotate({ description: 'UTM campaign parameter' })),
  /** UTM content (optional) */
  ux: optionalField(Schema.String.annotate({ description: 'UTM content parameter' })),
  /** UTM term (optional) */
  ut: optionalField(Schema.String.annotate({ description: 'UTM term parameter' })),
})

export type AnalyticsCollectPayload = typeof analyticsCollectSchema.Type

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
export const analyticsClickSchema = Schema.Struct({
  /** Absolute destination URL of the clicked anchor */
  href: Schema.String.annotate({
    description: 'Absolute destination URL of the clicked anchor',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** Destination hostname — recorded as the event name so grouping needs no extraction */
  hostname: Schema.String.annotate({
    description: 'Destination hostname — recorded as the event name',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** Path of the page the click happened on */
  pagePath: Schema.String.annotate({ description: 'Path of the page the click happened on' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
})

export type AnalyticsClickPayload = typeof analyticsClickSchema.Type

// ============================================================================
// Query Parameters Schema (shared across query endpoints)
// ============================================================================

/**
 * Analytics query parameters schema
 *
 * Shared query parameters for all analytics query endpoints.
 */
export const analyticsQuerySchema = Schema.Struct({
  /** Start of date range (ISO 8601) */
  from: Schema.String.annotate({ description: 'Start of date range (ISO 8601 datetime)' }),
  /** End of date range (ISO 8601) */
  to: Schema.String.annotate({ description: 'End of date range (ISO 8601 datetime)' }),
  /** Time series granularity */
  granularity: Schema.Literals(['hour', 'day', 'week', 'month'])
    .annotate({ description: 'Time series granularity' })
    .pipe(withDefault('day')),
})

export type AnalyticsQueryParams = typeof analyticsQuerySchema.Type

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Time series data point
 */
export const timeSeriesPointSchema = Schema.Struct({
  period: Schema.String.annotate({ description: 'Time period start (ISO 8601)' }),
  pageViews: Schema.Int.annotate({ description: 'Total page views in period' }),
  uniqueVisitors: Schema.Int.annotate({ description: 'Unique visitors in period' }),
  sessions: Schema.Int.annotate({ description: 'Unique sessions in period' }),
}).annotate({ identifier: 'TimeSeriesPoint' })

export type TimeSeriesPoint = typeof timeSeriesPointSchema.Type

/**
 * Analytics overview response schema
 *
 * GET /api/analytics/overview
 */
export const analyticsOverviewResponseSchema = Schema.Struct({
  summary: Schema.Struct({
    pageViews: Schema.Int.annotate({ description: 'Total page views' }),
    uniqueVisitors: Schema.Int.annotate({ description: 'Total unique visitors' }),
    sessions: Schema.Int.annotate({ description: 'Total sessions' }),
  }),
  timeSeries: Schema.Array(timeSeriesPointSchema).annotate({
    description: 'Time series data points',
  }),
})

export type AnalyticsOverviewResponse = typeof analyticsOverviewResponseSchema.Type

/**
 * Top pages response schema
 *
 * GET /api/analytics/pages
 */
export const analyticsTopPagesResponseSchema = Schema.Struct({
  pages: Schema.Array(
    Schema.Struct({
      path: Schema.String.annotate({ description: 'Page path' }),
      pageViews: Schema.Int.annotate({ description: 'Total page views' }),
      uniqueVisitors: Schema.Int.annotate({ description: 'Unique visitors' }),
    })
  ),
  total: Schema.Int.annotate({ description: 'Total number of pages' }),
})

export type AnalyticsTopPagesResponse = typeof analyticsTopPagesResponseSchema.Type

/**
 * Top referrers response schema
 *
 * GET /api/analytics/referrers
 */
export const analyticsTopReferrersResponseSchema = Schema.Struct({
  referrers: Schema.Array(
    Schema.Struct({
      domain: Schema.NullOr(
        Schema.String.annotate({ description: 'Referrer domain (null for direct traffic)' })
      ),
      pageViews: Schema.Int.annotate({ description: 'Total page views from this referrer' }),
      uniqueVisitors: Schema.Int.annotate({ description: 'Unique visitors from this referrer' }),
    })
  ),
  total: Schema.Int.annotate({ description: 'Total referrer entries' }),
})

export type AnalyticsTopReferrersResponse = typeof analyticsTopReferrersResponseSchema.Type

/**
 * Device breakdown entry schema
 */
const breakdownEntrySchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Category name' }),
  count: Schema.Int.annotate({ description: 'Number of page views' }),
  percentage: Schema.Finite.annotate({ description: 'Percentage of total (0-100)' }),
})

/**
 * Device breakdown response schema
 *
 * GET /api/analytics/devices
 */
export const analyticsDevicesResponseSchema = Schema.Struct({
  deviceTypes: Schema.Array(breakdownEntrySchema).annotate({
    description: 'Device type breakdown',
  }),
  browsers: Schema.Array(breakdownEntrySchema).annotate({ description: 'Browser name breakdown' }),
  operatingSystems: Schema.Array(breakdownEntrySchema).annotate({
    description: 'OS name breakdown',
  }),
})

export type AnalyticsDevicesResponse = typeof analyticsDevicesResponseSchema.Type

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
export const analyticsTargetsResponseSchema = Schema.Struct({
  targets: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({
        description:
          "The target's index as recorded on the click event, stringified — `targetIndex` is written from the first click of every link, including single-destination ones, so a split is readable back through data that predates the experiment.",
      }),
      count: Schema.Int.annotate({ description: 'Clicks attributed to this target' }),
      percentage: Schema.Finite.annotate({ description: 'Share of this link’s clicks (0-100)' }),
      destination: Schema.NullOr(
        Schema.String.annotate({
          description:
            'The destination that index currently resolves to, or null when the link has since been re-pointed and the index no longer maps. Null rather than omitted, so a stale split still renders a row instead of silently losing its clicks.',
        })
      ),
    })
  ).annotate({ description: 'Per-target click split for one link' }),
  total: Schema.Int.annotate({ description: 'Total clicks across all targets in the window' }),
})

/**
 * @public
 */
export type AnalyticsTargetsResponse = typeof analyticsTargetsResponseSchema.Type

/**
 * Campaign entry schema
 */
const campaignEntrySchema = Schema.Struct({
  source: Schema.NullOr(Schema.String.annotate({ description: 'UTM source' })),
  medium: Schema.NullOr(Schema.String.annotate({ description: 'UTM medium' })),
  campaign: Schema.NullOr(Schema.String.annotate({ description: 'UTM campaign' })),
  pageViews: Schema.Int.annotate({ description: 'Total page views' }),
  uniqueVisitors: Schema.Int.annotate({ description: 'Unique visitors' }),
})

/**
 * Campaigns response schema
 *
 * GET /api/analytics/campaigns
 */
export const analyticsCampaignsResponseSchema = Schema.Struct({
  campaigns: Schema.Array(campaignEntrySchema).annotate({ description: 'UTM campaign breakdown' }),
  total: Schema.Int.annotate({ description: 'Total campaign entries' }),
})

export type AnalyticsCampaignsResponse = typeof analyticsCampaignsResponseSchema.Type
