/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { storageStatusResponseSchema } from '@/domain/models/api/admin/storage/status'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

export const adminGroup: StaticGroupSpec = {
  tag: 'admin',
  tagDescription: 'Administrative storage and quota endpoints',
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
    {
      method: 'get',
      pathTemplate: '/api/admin/buckets/quota',
      summary: 'Get storage quota usage',
      description: 'Returns total stored bytes and file count across all buckets. Admin only.',
      operationIdBase: 'getAdminBucketsQuota',
      responses: {
        200: jsonResponse(
          z.object({
            totalBytes: z.number().describe('Total bytes stored'),
            fileCount: z.number().describe('Total number of stored files'),
          }),
          'Storage quota usage'
        ),
        500: errorResponse('Failed to retrieve storage quota'),
      },
    },
  ],
}
