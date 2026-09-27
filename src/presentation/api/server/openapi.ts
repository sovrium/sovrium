/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { healthCheckResponseSchema } from '@/domain/models/api/health/health'
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
        'Returns server health status. In an app that declares authentication, an anonymous ' +
        'or non-admin caller receives only `{ status, version }`; an admin-tier session, or ' +
        'any caller in an app without authentication, receives the detailed body.',
      operationIdBase: 'healthCheck',
      responses: {
        200: effectJsonResponse(healthCheckResponseSchema, 'Server is healthy'),
      },
    },
  ],
}
