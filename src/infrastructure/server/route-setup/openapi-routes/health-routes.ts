/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { healthResponseSchema } from '@/domain/models/api/health/health'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

export const healthGroup: StaticGroupSpec = {
  tag: 'infrastructure',
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
        200: jsonResponse(healthResponseSchema, 'Server is healthy'),
      },
    },
  ],
}
