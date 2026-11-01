/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { notFoundError } from './auth-not-found'
import { ORGANIZATION_MUTATION_PATHS } from './organization-admin-guard'
import type { AuthMiddlewareCtx } from './hook-context'

/**
 * The one header an API key is read from (`apiKeyHeaders` in
 * `plugins/api-key.ts`).
 */
export const API_KEY_HEADER = 'x-api-key'

/**
 * Whether a request presents an API key. A `before` hook runs BEFORE the
 * API-key plugin turns the key into a session, so a keyed request reads no
 * session there: a guard that must refuse a key asks this instead.
 */
export const presentsApiKey = (ctx: {
  readonly headers?: Pick<Headers, 'get'> | undefined
}): boolean => {
  const key = ctx.headers?.get(API_KEY_HEADER)
  return key !== null && key !== undefined && key !== ''
}

/**
 * Keep API keys off Better Auth's account-management endpoints
 * (`/api/auth/admin/*`: listing users, roles, bans, impersonation, creating
 * and removing accounts) and off every change to the organisation and its
 * groups (`/api/auth/organization/*`, {@link ORGANIZATION_MUTATION_PATHS}).
 *
 * A key carries its owner's full live role, so an administrator's key would
 * otherwise reach every one of them — and a leaked key could promote an
 * account or take one over. Those acts need the administrator signed in. A
 * request that presents a key there answers 404, the answer a route that does
 * not exist gives, whoever owns the key.
 *
 * This guard is also what stops a key on the organisation routes at all:
 * Better Auth runs this `before` hook BEFORE the API-key plugin turns the key
 * into a session, so the organisation guard reads no session for a keyed
 * request and could not refuse it. Sovrium's own `/api/admin/*` routes are not
 * Better Auth paths and are not affected; the `/api/auth/admin/*` HTTP door
 * refuses a key itself too (`applyAdminRoleCheckMiddleware`), which also
 * covers the invitation routes Sovrium serves there.
 */
export function applyApiKeyAdminPlaneGuard(ctx: AuthMiddlewareCtx): void {
  // `path` is absent on a path-less, server-only endpoint (`auth.api.addMember`).
  const path = ctx.path ?? ''
  if (!path.startsWith('/admin/') && !ORGANIZATION_MUTATION_PATHS.has(path)) return
  if (!presentsApiKey(ctx)) return
  throw notFoundError()
}
