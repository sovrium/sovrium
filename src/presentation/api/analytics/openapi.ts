/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  analyticsCampaignsResponseSchema,
  analyticsCollectSchema,
  analyticsDevicesResponseSchema,
  analyticsOverviewResponseSchema,
  analyticsQuerySchema,
  analyticsTopPagesResponseSchema,
  analyticsTopReferrersResponseSchema,
} from '@/domain/models/api/analytics/analytics'
import { successResponseSchema } from '@/domain/models/api/combinators/common'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

/** Analytics route group. */
export const analyticsGroup: StaticGroupSpec = {
  tag: 'Analytics',
  tagDescription: 'Analytics collection and reporting endpoints',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/analytics/collect',
      summary: 'Collect analytics event',
      description: 'Records a page view event. Uses single-letter keys to minimize payload size.',
      operationIdBase: 'collectAnalytics',

      request: { body: effectJsonBody(analyticsCollectSchema) },
      responses: {
        200: effectJsonResponse(successResponseSchema, 'Event collected'),
        400: errorResponse('Validation error'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/overview',
      summary: 'Get analytics overview',
      description: 'Returns summary statistics and time series data for the given date range.',
      operationIdBase: 'getAnalyticsOverview',

      parameters: effectParameters(analyticsQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(analyticsOverviewResponseSchema, 'Analytics overview'),
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

      parameters: effectParameters(analyticsQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(analyticsTopPagesResponseSchema, 'Top pages'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/referrers',
      summary: 'Get top referrers',
      description: 'Returns traffic sources ranked by page views.',
      operationIdBase: 'getAnalyticsTopReferrers',

      parameters: effectParameters(analyticsQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(analyticsTopReferrersResponseSchema, 'Top referrers'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/devices',
      summary: 'Get device breakdown',
      description: 'Returns visitor breakdown by device type, browser, and operating system.',
      operationIdBase: 'getAnalyticsDevices',

      parameters: effectParameters(analyticsQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(analyticsDevicesResponseSchema, 'Device breakdown'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/analytics/campaigns',
      summary: 'Get campaign breakdown',
      description: 'Returns UTM campaign performance data.',
      operationIdBase: 'getAnalyticsCampaigns',

      parameters: effectParameters(analyticsQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(analyticsCampaignsResponseSchema, 'Campaign breakdown'),
        401: errorResponse('Unauthorized'),
      },
    },
  ],
}
