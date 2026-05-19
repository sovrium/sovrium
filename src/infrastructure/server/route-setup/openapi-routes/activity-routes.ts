/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  getActivityLogResponseSchema,
  listActivityLogsResponseSchema,
} from '@/domain/models/api/activity/activity'
import { activityIdParamSchema, activityQuerySchema } from '@/domain/models/api/activity/params'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

export const activityGroup: StaticGroupSpec = {
  tag: 'activity',
  tagDescription: 'Activity log and audit trail endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/activity',
      summary: 'List activity logs',
      description:
        'Returns paginated activity logs with optional filtering by table or action type.',
      operationIdBase: 'listActivityLogs',
      request: { query: activityQuerySchema },
      responses: {
        200: jsonResponse(listActivityLogsResponseSchema, 'Activity logs'),
        401: errorResponse('Unauthorized'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/activity/{activityId}',
      summary: 'Get activity log details',
      description: 'Returns a single activity log entry with full change details.',
      operationIdBase: 'getActivityLog',
      request: { params: activityIdParamSchema },
      responses: {
        200: jsonResponse(getActivityLogResponseSchema, 'Activity log details'),
        401: errorResponse('Unauthorized'),
        404: errorResponse('Activity not found'),
      },
    },
  ],
}
