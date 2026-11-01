/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** What a bucket WRITE (upload / delete) falls back to, and how it is refused. */

import { Effect } from 'effect'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { servesNoAuthVisitor } from '@/domain/models/app/auth/anonymous-grant-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import {
  permitsBucketFileDelete,
  type BucketFileCaller,
} from '@/domain/models/app/buckets/bucket-file-access-validation'
import { isSystemBucketName } from '@/domain/models/app/buckets/bucket-identity'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { Context } from 'hono'

/**
 * The gate an UPLOAD falls back to when the bucket declares no permission for
 * it.
 *
 * - A private bucket: any signed-in caller.
 * - A `public: true` bucket: an administrator only (the built-in `admin` or the
 *   app's top role), on every app. A file anyone can download should not be one
 *   anyone can place, so `public: true` never widens a write; it narrows the
 *   undeclared one. On an app with no `auth` block nobody can sign in, so such
 *   a bucket takes no upload until it declares one.
 * - The built-in `system` bucket, which nobody declares and which resolves to
 *   `public: !app.auth`: a visitor of an app with no `auth` block may place a
 *   NEW file there (that is where a page's file-upload form puts its
 *   attachment), any signed-in caller otherwise. It is not a bucket an author
 *   opened to the world, so the public rule above does not reach it. Placing
 *   a file at a key that already holds one is an overwrite, which no visitor
 *   may make there (`refuseUnlessOwnerOrAdmin`).
 *
 * The way out is the explicit lever: `permissions: { upload: 'authenticated' }`,
 * or `'all'`, on the bucket. The caller's role is read only on the one branch
 * that needs it, so a private or declared bucket costs no extra query.
 */
export function defaultWriteGrant(app: App, bucket: Bucket, session: UserSession | undefined) {
  if (isSystemBucketName(bucket.name)) {
    return Effect.succeed(
      (bucket.public === true && servesNoAuthVisitor(app)) || session !== undefined
    )
  }
  if (session === undefined) return Effect.succeed(false)
  if (bucket.public !== true || bucket.permissions?.upload !== undefined) {
    return Effect.succeed(true)
  }
  return Effect.map(getUserRole(session.userId, app), (role) => isAdminEquivalent(role, app))
}

/**
 * The delete rung of a bucket file: the domain's own decision
 * (`permitsBucketFileDelete`), so the files API and an automation's
 * `file/delete` cannot drift apart. `caller` is `undefined` with no session.
 * Answers the refusal, or nothing when the delete may proceed.
 *
 * On an app with no `auth` block nobody can sign in, so a visitor deletes only
 * from a bucket that declares `delete: 'all'`, and the 401 of {@link denyWrite}
 * would ask her for something she cannot do and mark the key as worth asking
 * about: she gets the unknown key's 404 instead, body for body, as a delete of
 * a key the bucket never held answers.
 */
export function deleteRefusal(
  c: Context,
  input: {
    readonly app: App
    readonly bucket: Bucket
    readonly caller: BucketFileCaller | undefined
    readonly session: UserSession | undefined
  }
): Response | undefined {
  const { app, bucket, caller, session } = input
  if (permitsBucketFileDelete(bucket, caller, { app })) return undefined
  return servesNoAuthVisitor(app) ? notFound(c, 'File not found') : denyWrite(c, session)
}

/**
 * Denial response for a write the caller may not perform.
 *
 * Anonymous → 401: actionable for the caller, and it carries no existence
 * signal. Authenticated but refused by role → 404: a post-authentication role
 * denial WOULD leak the bucket's existence, so it drops to the read path's
 * anti-enumeration code (S1). Mirrors `createHandleSign` — the split is by
 * endpoint and deliberate, never 403.
 */
export function denyWrite(c: Context, session: UserSession | undefined): Response {
  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      401
    )
  }
  return notFound(c, 'Resource not found')
}
