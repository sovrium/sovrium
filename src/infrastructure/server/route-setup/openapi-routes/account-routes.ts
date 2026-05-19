/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  accountDeleteCancelledResponseSchema,
  accountDeleteRequestSchema,
  accountDeleteScheduledResponseSchema,
  accountExportResponseSchema,
} from '@/domain/models/api/account/account'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

export const accountGroup: StaticGroupSpec = {
  tag: 'account',
  tagDescription: 'Authenticated-user account data and erasure (GDPR) endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/account/export',
      summary: 'Export account data',
      description:
        'Returns a full personal-data export for the authenticated user (GDPR Art. 15 and 20).',
      operationIdBase: 'getAccountExport',
      responses: {
        200: jsonResponse(accountExportResponseSchema, 'Personal data export'),
        401: errorResponse('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/account/delete',
      summary: 'Schedule or cancel account deletion',
      description: 'Schedules erasure of the authenticated account, or cancels a pending erasure.',
      operationIdBase: 'postAccountDelete',
      request: {
        body: { content: { 'application/json': { schema: accountDeleteRequestSchema } } },
      },
      responses: {
        200: jsonResponse(accountDeleteCancelledResponseSchema, 'Pending erasure cancelled'),
        202: jsonResponse(accountDeleteScheduledResponseSchema, 'Erasure scheduled'),
        400: errorResponse('Request matches neither the confirm nor the cancel shape'),
        401: errorResponse('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/account/purge-due',
      summary: 'Purge accounts past their erasure grace period',
      description:
        'Internal scheduler endpoint. Requires the X-Internal-Scheduler-Token header. Returns 404 when the token is unset or invalid (anti-enumeration).',
      operationIdBase: 'postAccountPurgeDue',
      responses: {
        200: jsonResponse(
          z.object({
            status: z.string().describe('Purge outcome'),
            purgedCount: z.number().describe('Number of accounts purged'),
          }),
          'Purge completed'
        ),
        404: errorResponse('Scheduler token unset or invalid'),
      },
    },
  ],
}
