/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { healthResponseSchema } from '@/domain/models/api/health/health'
import { effectJsonResponse } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/** Health check route group. */
export const healthGroup: StaticGroupSpec = {
  tag: 'Infrastructure',
  tagDescription: 'Infrastructure endpoints (health, metrics)',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/health',
      summary: 'Health check endpoint',
      description:
        'Returns server health status. Used by monitoring tools and E2E tests to verify server is running.',
      operationIdBase: 'healthCheck',
      responses: {
        200: effectJsonResponse(healthResponseSchema, 'Server is healthy'),
      },
    },
  ],
}
