/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const analyticsCollectSchema = z.object({
  p: z.string().min(1).describe('Page path being viewed'),
  t: z.string().optional().describe('Page title'),
  r: z.string().optional().describe('Full referrer URL'),
  sw: z.number().int().positive().optional().describe('Screen width in pixels'),
  sh: z.number().int().positive().optional().describe('Screen height in pixels'),
  us: z.string().optional().describe('UTM source parameter'),
  um: z.string().optional().describe('UTM medium parameter'),
  uc: z.string().optional().describe('UTM campaign parameter'),
  ux: z.string().optional().describe('UTM content parameter'),
  ut: z.string().optional().describe('UTM term parameter'),
})

export type AnalyticsCollectPayload = z.infer<typeof analyticsCollectSchema>


export const analyticsQuerySchema = z.object({
  from: z.string().describe('Start of date range (ISO 8601 datetime)'),
  to: z.string().describe('End of date range (ISO 8601 datetime)'),
  granularity: z
    .enum(['hour', 'day', 'week', 'month'])
    .default('day')
    .describe('Time series granularity'),
})

export type AnalyticsQueryParams = z.infer<typeof analyticsQuerySchema>


export const timeSeriesPointSchema = z
  .object({
    period: z.string().describe('Time period start (ISO 8601)'),
    pageViews: z.number().int().describe('Total page views in period'),
    uniqueVisitors: z.number().int().describe('Unique visitors in period'),
    sessions: z.number().int().describe('Unique sessions in period'),
  })
  .openapi('TimeSeriesPoint')

export type TimeSeriesPoint = z.infer<typeof timeSeriesPointSchema>

export const analyticsOverviewResponseSchema = z.object({
  summary: z.object({
    pageViews: z.number().int().describe('Total page views'),
    uniqueVisitors: z.number().int().describe('Total unique visitors'),
    sessions: z.number().int().describe('Total sessions'),
  }),
  timeSeries: z.array(timeSeriesPointSchema).describe('Time series data points'),
})

export type AnalyticsOverviewResponse = z.infer<typeof analyticsOverviewResponseSchema>

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

const breakdownEntrySchema = z.object({
  name: z.string().describe('Category name'),
  count: z.number().int().describe('Number of page views'),
  percentage: z.number().describe('Percentage of total (0-100)'),
})

export const analyticsDevicesResponseSchema = z.object({
  deviceTypes: z.array(breakdownEntrySchema).describe('Device type breakdown'),
  browsers: z.array(breakdownEntrySchema).describe('Browser name breakdown'),
  operatingSystems: z.array(breakdownEntrySchema).describe('OS name breakdown'),
})

export type AnalyticsDevicesResponse = z.infer<typeof analyticsDevicesResponseSchema>

const campaignEntrySchema = z.object({
  source: z.string().nullable().describe('UTM source'),
  medium: z.string().nullable().describe('UTM medium'),
  campaign: z.string().nullable().describe('UTM campaign'),
  pageViews: z.number().int().describe('Total page views'),
  uniqueVisitors: z.number().int().describe('Unique visitors'),
})

export const analyticsCampaignsResponseSchema = z.object({
  campaigns: z.array(campaignEntrySchema).describe('UTM campaign breakdown'),
  total: z.number().int().describe('Total campaign entries'),
})

export type AnalyticsCampaignsResponse = z.infer<typeof analyticsCampaignsResponseSchema>
