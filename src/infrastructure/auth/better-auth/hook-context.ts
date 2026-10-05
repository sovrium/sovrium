/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAPIError } from 'better-auth/api'
import type { createAuthMiddleware } from 'better-auth/api'

/**
 * Reading a Better Auth hook context: which request it is, who is calling,
 * which account the body names, and whether the endpoint succeeded. Shared by
 * every Sovrium `before`/`after` hook so they all read a request the same way.
 */

/**
 * The Better Auth hook context. Re-derived here (rather than imported from
 * `auth.ts`) so the hook modules have no cycle back to the instance factory
 * that consumes them.
 */
export type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * The request's endpoint context, when it is an object that can key a WeakMap.
 *
 * Better Auth hands the before hooks, the endpoint and the after hooks one and
 * the same `ctx.context` object per dispatch (a fresh copy of the auth context,
 * which its middlewares extend in place), so it identifies the request without
 * any state of Sovrium's own. Keying a WeakMap on it lets a before hook hand
 * what it read to the after hook of the same request, and lets the entry go
 * with the request — including one the after hook never reads.
 */
// eslint-disable-next-line functional/prefer-immutable-types
export const requestKey = (ctx: AuthMiddlewareCtx): object | undefined => {
  const key: unknown = (ctx as { context?: unknown }).context
  return typeof key === 'object' && key !== null ? key : undefined
}

/** The non-empty `userId` the request body names, when it names one. */
// eslint-disable-next-line functional/prefer-immutable-types
export const readTargetUserId = (ctx: AuthMiddlewareCtx): string | undefined => {
  const body = ctx.body as { userId?: unknown } | undefined
  return typeof body?.userId === 'string' && body.userId !== '' ? body.userId : undefined
}

/** The id of the account a Better Auth session belongs to, when there is one. */
export const sessionUserId = (session: unknown): string | undefined => {
  const id = (session as { readonly user?: { readonly id?: unknown } } | null | undefined)?.user?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/**
 * `true` when a Better Auth endpoint completed, read from the `returned` value
 * its `after` hooks receive.
 *
 * Better Auth stores a REFUSAL there too: when the handler throws an
 * `APIError` (a too-short password, an unknown user, a self-ban), the dispatch
 * catches it and hands the error itself to the after hooks as `returned`. So
 * "is there a value" is not "did it succeed", and an after hook that reads it
 * that way acts on a request that changed nothing — revoking sessions, sending
 * an "account deleted" email, or writing an audit entry for an act that never
 * stood.
 *
 * The one rule every after hook uses: a value was returned, and it is neither
 * an `APIError` nor a non-2xx `Response`.
 */
export const endpointSucceeded = (returned: unknown): boolean => {
  if (returned === undefined || returned === null || isAPIError(returned)) return false
  return !(returned instanceof Response) || returned.ok
}
