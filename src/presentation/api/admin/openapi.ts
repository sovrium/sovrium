/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ADMIN_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { clearTransformCacheResponseSchema } from '@/domain/models/api/admin/storage/transform-cache'
import { toAdminReadRouteSpec } from '@/presentation/api/admin/read-operation-routes'
import { effectJsonResponse } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/**
 * Admin read-endpoint group: every entry of the admin read-operation registry —
 * derived from the same entries the routes are mounted from, so a registered
 * read cannot be served undocumented — plus the transform-cache purge.
 */
export const adminGroup: StaticGroupSpec = {
  tag: 'Admin',
  tagDescription:
    'Administrative read endpoints: configuration, console, design-system, schema and automation reads',
  routes: [
    ...ADMIN_READ_OPERATIONS.map(toAdminReadRouteSpec),
    {
      method: 'delete',
      pathTemplate: '/api/admin/storage/transform-cache',
      summary: 'Clear the image transform cache',
      description:
        'Discards the derived image-transform variants. Stored originals are never ' +
        'touched — transforms are recomputed on demand from them, so the only effect ' +
        'is that the next request for each variant pays for a fresh transform. The ' +
        'operation is idempotent: clearing an already-empty cache succeeds and reports ' +
        'zero. Admin only.',
      operationIdBase: 'deleteAdminStorageTransformCache',
      responses: {
        // 200 is the ONLY declared code because the handler has no failure
        // path: it calls a synchronous cache primitive and returns its counts.
        // Admin gating happens upstream in `createApiRoutes`, so the 401/404
        // it produces belong to that middleware, not to this operation.
        200: effectJsonResponse(clearTransformCacheResponseSchema, 'Transform cache cleared'),
      },
    },
  ],
}
