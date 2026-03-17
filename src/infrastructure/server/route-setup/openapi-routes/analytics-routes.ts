/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  analyticsCollectSchema,
  analyticsQuerySchema,
  analyticsOverviewResponseSchema,
  analyticsTopPagesResponseSchema,
  analyticsTopReferrersResponseSchema,
  analyticsDevicesResponseSchema,
  analyticsCampaignsResponseSchema,
} from '@/domain/models/api/analytics'
import { successResponseSchema } from '@/domain/models/api/common'
import { errorResponseSchema } from '@/domain/models/api/error'

/**
 * Register analytics routes for OpenAPI schema generation
 */
export function registerAnalyticsRoutes(app: OpenAPIHono): void {
  // POST /api/analytics/collect
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/analytics/collect',
      summary: 'Collect analytics event',
      description: 'Records a page view event. Uses single-letter keys to minimize payload size.',
      operationId: 'collectAnalytics',
      tags: ['analytics'],
      request: {
        body: {
          content: { 'application/json': { schema: analyticsCollectSchema } },
        },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: successResponseSchema } },
          description: 'Event collected',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Validation error',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/analytics/overview
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/analytics/overview',
      summary: 'Get analytics overview',
      description: 'Returns summary statistics and time series data for the given date range.',
      operationId: 'getAnalyticsOverview',
      tags: ['analytics'],
      request: { query: analyticsQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: analyticsOverviewResponseSchema } },
          description: 'Analytics overview',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Invalid date range',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/analytics/pages
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/analytics/pages',
      summary: 'Get top pages',
      description: 'Returns most visited pages with view counts and unique visitors.',
      operationId: 'getAnalyticsTopPages',
      tags: ['analytics'],
      request: { query: analyticsQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: analyticsTopPagesResponseSchema } },
          description: 'Top pages',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/analytics/referrers
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/analytics/referrers',
      summary: 'Get top referrers',
      description: 'Returns traffic sources ranked by page views.',
      operationId: 'getAnalyticsTopReferrers',
      tags: ['analytics'],
      request: { query: analyticsQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: analyticsTopReferrersResponseSchema } },
          description: 'Top referrers',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/analytics/devices
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/analytics/devices',
      summary: 'Get device breakdown',
      description: 'Returns visitor breakdown by device type, browser, and operating system.',
      operationId: 'getAnalyticsDevices',
      tags: ['analytics'],
      request: { query: analyticsQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: analyticsDevicesResponseSchema } },
          description: 'Device breakdown',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/analytics/campaigns
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/analytics/campaigns',
      summary: 'Get campaign breakdown',
      description: 'Returns UTM campaign performance data.',
      operationId: 'getAnalyticsCampaigns',
      tags: ['analytics'],
      request: { query: analyticsQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: analyticsCampaignsResponseSchema } },
          description: 'Campaign breakdown',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
      },
    }),
    (c) => c.json({} as never)
  )
}
