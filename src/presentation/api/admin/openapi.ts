/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ADMIN_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { clearTransformCacheResponseSchema } from '@/domain/models/api/admin/storage/transform-cache'
import {
  adminUserGroupsUpdateRequestSchema,
  adminUserGroupsUpdateResponseSchema,
} from '@/domain/models/api/admin/users/groups'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { toAdminReadRouteSpec } from '@/presentation/api/admin/read-operation-routes'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
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
    {
      method: 'put',
      pathTemplate: '/api/admin/users/{userId}/groups',
      summary: "Set an account's groups",
      description:
        'Sets the groups the account belongs to to exactly the listed names — the whole ' +
        'desired set, so a group left out is left and an empty list leaves every group. ' +
        'Answers what the membership became and what was added and removed; sending the ' +
        'set the account already has changes nothing. Every name must be declared in ' +
        '`auth.groups`, and a group may not be filled past its `maxMembers`; a refused ' +
        'request changes nothing. Admin-equivalent callers only (session or API key); ' +
        'every other caller, and an unknown account, receives 404.',
      operationIdBase: 'setAdminUserGroups',
      parameters: effectParameters(
        Schema.Struct({
          userId: Schema.String.annotate({ description: 'The account whose groups are set' }),
        }),
        'path'
      ),
      request: { body: effectJsonBody(adminUserGroupsUpdateRequestSchema) },
      responses: {
        200: effectJsonResponse(
          adminUserGroupsUpdateResponseSchema,
          'The membership after the write'
        ),
        400: effectJsonResponse(errorResponseSchema, 'Not a list of names, or an undeclared group'),
        404: effectJsonResponse(errorResponseSchema, 'Not an administrator, or no such account'),
        422: effectJsonResponse(errorResponseSchema, 'A group would exceed its maxMembers'),
      },
    },
  ],
}
