/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { storageStatusResponseSchema } from '@/domain/models/api/admin/storage/status'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

/** Admin storage route group. */
export const adminGroup: StaticGroupSpec = {
  tag: 'Admin',
  tagDescription: 'Administrative storage endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/admin/storage/status',
      summary: 'Get storage status',
      description: 'Returns the configured storage provider and its settings. Admin only.',
      operationIdBase: 'getAdminStorageStatus',
      responses: {
        200: jsonResponse(storageStatusResponseSchema, 'Storage status'),
        500: errorResponse('Failed to build storage status'),
      },
    },
  ],
}
