/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { successResponseSchema } from '@/domain/models/api/_shared/common'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  analyticsCampaignsResponseSchema,
  analyticsCollectSchema,
  analyticsDevicesResponseSchema,
  analyticsOverviewResponseSchema,
  analyticsQuerySchema,
  analyticsTopPagesResponseSchema,
  analyticsTopReferrersResponseSchema,
} from '@/domain/models/api/analytics/analytics'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

export const analyticsGroup: StaticGroupSpec = {
  tag: 'analytics',
  tagDescription: 'Analytics collection and reporting endpoints',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/analytics/collect',
      summary: 'Collect analytics event',
      description: 'Records a page view event. Uses single-letter keys to minimize payload size.',
      operationIdBase: 'collectAnalytics',
      request: {
        body: { content: { 'application/json': { schema: analyticsCollectSchema } } },
      },
      responses: {
        200: jsonResponse(successResponseSchema, 'Event collected'),
        400: errorResponse('Validation error'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/overview',
      summary: 'Get analytics overview',
      description: 'Returns summary statistics and time series data for the given date range.',
      operationIdBase: 'getAnalyticsOverview',
      request: { query: analyticsQuerySchema },
      responses: {
        200: jsonResponse(analyticsOverviewResponseSchema, 'Analytics overview'),
        400: errorResponse('Invalid date range'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/pages',
      summary: 'Get top pages',
      description: 'Returns most visited pages with view counts and unique visitors.',
      operationIdBase: 'getAnalyticsTopPages',
      request: { query: analyticsQuerySchema },
      responses: {
        200: jsonResponse(analyticsTopPagesResponseSchema, 'Top pages'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/referrers',
      summary: 'Get top referrers',
      description: 'Returns traffic sources ranked by page views.',
      operationIdBase: 'getAnalyticsTopReferrers',
      request: { query: analyticsQuerySchema },
      responses: {
        200: jsonResponse(analyticsTopReferrersResponseSchema, 'Top referrers'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/devices',
      summary: 'Get device breakdown',
      description: 'Returns visitor breakdown by device type, browser, and operating system.',
      operationIdBase: 'getAnalyticsDevices',
      request: { query: analyticsQuerySchema },
      responses: {
        200: jsonResponse(analyticsDevicesResponseSchema, 'Device breakdown'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/campaigns',
      summary: 'Get campaign breakdown',
      description: 'Returns UTM campaign performance data.',
      operationIdBase: 'getAnalyticsCampaigns',
      request: { query: analyticsQuerySchema },
      responses: {
        200: jsonResponse(analyticsCampaignsResponseSchema, 'Campaign breakdown'),
        401: errorResponse('Unauthorized'),
      },
    },
  ],
}
