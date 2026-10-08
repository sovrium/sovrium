/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  healthCheckResponseSchema,
  healthProbeResponseSchema,
} from '@/domain/models/api/health/health'
import { effectJsonResponse } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/** The readiness body, as the published document names it. */
const readinessResponseSchema = healthProbeResponseSchema.annotate({
  title: 'Readiness',
  description: 'Any caller, with `?probe=db`: the minimal body plus one outcome per check',
})

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
        'any caller in an app without authentication, receives the detailed body. With ' +
        '`?probe=db` it is a readiness probe instead: one `SELECT 1` with a 2-second budget, ' +
        'answered to every caller with `{ status, version, checks }` — 200 when the database ' +
        'answered, 503 `degraded` when it did not.',
      operationIdBase: 'healthCheck',
      parameters: [
        {
          name: 'probe',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['db'] },
          description: 'Run a readiness check of the database instead of answering liveness',
        },
      ],
      responses: {
        200: effectJsonResponse(
          Schema.Union([healthCheckResponseSchema, readinessResponseSchema]),
          'Server is healthy, or ready when probed'
        ),
        400: effectJsonResponse(errorResponseSchema, 'Unknown probe'),
        503: effectJsonResponse(readinessResponseSchema, 'Probed dependency is not ready'),
      },
    },
  ],
}
