/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  activeScopeGetResponseSchema,
  activeScopeSetResponseSchema,
  setActiveScopeRequestSchema,
} from '@/domain/models/api/session/active-scope'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/**
 * Active-scope session routes — get, set, and clear the user active record for
 * a scope table. The `{tableSlug}` segment is a scope-table name (documented as
 * a literal path parameter).
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const tableSlugParam = Schema.Struct({
  tableSlug: Schema.String.annotate({ description: 'Scope table name' }),
})

/** Active-scope session route group. */
export const activeScopeGroup: StaticGroupSpec = {
  tag: 'Session',
  tagDescription: 'Active-scope session endpoints',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/session/active-scope/{tableSlug}',
      summary: 'Set the active scope',
      description: 'Sets the active record for a scope table and stores it in a session cookie.',
      operationIdBase: 'setActiveScope',

      parameters: effectParameters(tableSlugParam, 'path'),
      request: { body: effectJsonBody(setActiveScopeRequestSchema) },
      responses: {
        200: effectJsonResponse(activeScopeSetResponseSchema, 'Active scope set'),
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

      parameters: effectParameters(tableSlugParam, 'path'),
      responses: {
        200: effectJsonResponse(activeScopeGetResponseSchema, 'Active scope'),
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

      parameters: effectParameters(tableSlugParam, 'path'),
      responses: {
        204: { description: 'Active scope cleared (no content)' },
        401: errorResponse('Not authenticated'),
        404: errorResponse('Scope tables disabled or table not a scope table'),
        500: errorResponse('Internal server error'),
      },
    },
  ],
}
