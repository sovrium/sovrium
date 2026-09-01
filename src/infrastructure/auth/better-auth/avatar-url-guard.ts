/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import type { createAuthMiddleware } from 'better-auth/api'

/**
 * The Better Auth `before`-hook context. Re-derived here (rather than imported
 * from `auth.ts`) so this guard module has no cycle back to the instance
 * factory that consumes it — same reasoning as `admin-role-guards.ts`.
 */
type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * Endpoints on which a CLIENT can put a value into `auth.user.image`, and where
 * in the body it sits.
 *
 * Better Auth writes that column verbatim from the request body and validates
 * only that it is a string, so every one of these is an unguarded write to a
 * column that several readers project into OTHER users' browsers as an
 * `<img src>`. Guarding one and not the rest would be theatre: the value
 * arrives at the same column either way.
 *
 * - `/sign-up/email` — `body.image`, and note this one is **unauthenticated**:
 *   anyone who can register can seed the column before they ever hold a
 *   session (vendored `sign-up.ts` writes `image: image ?? null`).
 * - `/update-user` — `body.image`, the self-service path, session-scoped.
 * - `/admin/create-user`, `/admin/update-user` — `body.data.image`. Both take a
 *   `data: z.record(z.string(), z.any())` passthrough for additional fields,
 *   so `image` rides in on it without appearing in either body schema. An admin
 *   is trusted to administer, not to plant a third-party asset in a column that
 *   renders into every other user's browser.
 *
 * The nesting mirrors `admin-role-guards.ts`, where `/admin/update-user` puts
 * `role` under `data` for the same reason. Reading the wrong key there silently
 * skips validation, so the location is data, not a conditional.
 */
const IMAGE_WRITING_PATHS: ReadonlyMap<string, 'body' | 'data'> = new Map([
  ['/sign-up/email', 'body'],
  ['/update-user', 'body'],
  ['/admin/create-user', 'data'],
  ['/admin/update-user', 'data'],
])

/**
 * Read the `image` field, distinguishing "absent" from "present and null".
 *
 * The distinction is load-bearing: absent means the request is not about the
 * avatar at all and must pass through untouched (a plain name change through
 * `/update-user` must keep working), whereas an explicit `null` is a caller
 * clearing their avatar, which is allowed.
 */
// eslint-disable-next-line functional/prefer-immutable-types
const readImageField = (ctx: AuthMiddlewareCtx, location: 'body' | 'data'): unknown => {
  const body = ctx.body as { image?: unknown; data?: { image?: unknown } } | undefined
  if (location === 'data') {
    const data = body?.data
    if (typeof data !== 'object' || data === null) return undefined
    return (data as { image?: unknown }).image
  }
  return body?.image
}

/**
 * Refuse any client-supplied avatar URL, with a 400. `null` (clear the avatar)
 * and an absent field both pass.
 *
 * ─── WHY EVERY NON-NULL VALUE, RATHER THAN A SHAPE CHECK ────────────────────
 *
 * The obvious guard is "accept a URL this instance issued", i.e. shape-check
 * against `/api/buckets/{bucket}/files/{key}`. That is NOT enough, and the spec
 * says so by refusing `/api/buckets/avatars/files/not-mine.png` — a value with
 * exactly the right shape. Shape proves the URL points at THIS origin; it does
 * not prove the object is the caller's. Ownership is unknowable today because
 * `file_storage_metadata.uploaded_by_id` is written by nothing, so a
 * shape-only allow-list would let any user point their avatar at any object in
 * any public bucket — another user's avatar, or an uploaded document — and have
 * this instance serve it under its own origin as that user's face.
 *
 * So the rule is the narrow one: a client may CLEAR the column and nothing
 * else. Setting it is a server-side act, performed by the upload route after it
 * has written the bytes itself and therefore knows what it issued.
 *
 * ─── FOR WHOEVER BUILDS THE UPLOAD ROUTE NEXT ───────────────────────────────
 *
 * This guard runs on the Better Auth request path, which `auth.api.updateUser`
 * also traverses. An upload route that persists by calling the public
 * `/update-user` endpoint would therefore be refused by this guard. Write the
 * column through the internal adapter instead. That is not an obstacle to work
 * around — it is the boundary doing its job: "the server issued this URL" is a
 * fact only the server-side path can attest to.
 *
 * ─── STATUS CODE ────────────────────────────────────────────────────────────
 *
 * 400, not 404. Standing rule S1 mandates 404 for UNAUTHORIZED access, so that
 * a probe cannot distinguish "exists but forbidden" from "does not exist". No
 * such ambiguity exists here: the caller is writing their OWN row, is allowed
 * to write it, and has simply sent a value that is not permitted. There is
 * nothing to enumerate, so a 400 discloses nothing and — unlike a 404 — tells
 * the caller what to fix.
 */
// eslint-disable-next-line functional/prefer-immutable-types
export function applyAvatarUrlGuard(ctx: AuthMiddlewareCtx) {
  const location = IMAGE_WRITING_PATHS.get(ctx.path)
  if (location === undefined) return

  const image = readImageField(ctx, location)
  // Absent → the request is not about the avatar. Explicit null → clearing it.
  if (image === undefined || image === null) return

  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('BAD_REQUEST', {
    message:
      'A profile image cannot be set directly. Upload one through the account avatar endpoint, or send `image: null` to clear it.',
  })
}
