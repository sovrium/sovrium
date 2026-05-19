/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  activeScopeGetResponseSchema,
  activeScopeSetResponseSchema,
  setActiveScopeRequestSchema,
} from '@/domain/models/api/session/active-scope'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const tableSlugParam = z.object({ tableSlug: z.string().describe('Scope table name') })

export const activeScopeGroup: StaticGroupSpec = {
  tag: 'session',
  tagDescription: 'Active-scope session endpoints',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/session/active-scope/{tableSlug}',
      summary: 'Set the active scope',
      description: 'Sets the active record for a scope table and stores it in a session cookie.',
      operationIdBase: 'setActiveScope',
      request: {
        params: tableSlugParam,
        body: { content: { 'application/json': { schema: setActiveScopeRequestSchema } } },
      },
      responses: {
        200: jsonResponse(activeScopeSetResponseSchema, 'Active scope set'),
        400: errorResponse('recordId required'),
        401: errorResponse('Not authenticated'),
        403: errorResponse('recordId not in the accessible scope'),
        404: errorResponse('Scope tables disabled or table not a scope table'),
        500: errorResponse('Internal server error'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/session/active-scope/{tableSlug}',
      summary: 'Get the active scope',
      description: 'Returns the current active record for a scope table, or null when unset.',
      operationIdBase: 'getActiveScope',
      request: { params: tableSlugParam },
      responses: {
        200: jsonResponse(activeScopeGetResponseSchema, 'Active scope'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Scope tables disabled or table not a scope table'),
        500: errorResponse('Internal server error'),
      },
    },
    {
      method: 'delete',
      pathTemplate: '/api/session/active-scope/{tableSlug}',
      summary: 'Clear the active scope',
      description: 'Clears the active-scope cookie for a scope table.',
      operationIdBase: 'clearActiveScope',
      request: { params: tableSlugParam },
      responses: {
        204: { description: 'Active scope cleared (no content)' },
        401: errorResponse('Not authenticated'),
        404: errorResponse('Scope tables disabled or table not a scope table'),
        500: errorResponse('Internal server error'),
      },
    },
  ],
}
