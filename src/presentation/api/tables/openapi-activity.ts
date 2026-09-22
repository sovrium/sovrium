/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  getActivityLogResponseSchema,
  listActivityLogsResponseSchema,
} from '@/domain/models/api/activity/activity'
import { activityIdParamSchema, activityQuerySchema } from '@/domain/models/api/activity/params'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { effectJsonResponse, effectParameters } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

/** Activity log route group. */
export const activityGroup: StaticGroupSpec = {
  tag: 'Activity',
  tagDescription: 'Activity log and audit trail endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/activity',
      summary: 'List activity logs',
      description:
        'Returns paginated activity logs with optional filtering by table or action type.',
      operationIdBase: 'listActivityLogs',

      parameters: effectParameters(activityQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(listActivityLogsResponseSchema, 'Activity logs'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/activity/{activityId}',
      summary: 'Get activity log details',
      description: 'Returns a single activity log entry with full change details.',
      operationIdBase: 'getActivityLog',

      parameters: effectParameters(activityIdParamSchema, 'path'),
      responses: {
        200: effectJsonResponse(getActivityLogResponseSchema, 'Activity log details'),
        401: errorResponse('Unauthorized'),
        404: errorResponse('Activity not found'),
      },
    },
  ],
}
