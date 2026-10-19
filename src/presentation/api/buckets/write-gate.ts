/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** What a bucket WRITE (upload / delete) falls back to, and how it is refused. */

import {
  permitsBucketFileDelete,
  type BucketFileCaller,
} from '@/domain/models/app/buckets/bucket-file-access-validation'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { Context } from 'hono'

/**
 * The gate an UPLOAD falls back to when the bucket declares no
 * permission for it: a session is required.
 *
 * `public: true` governs READS only — it grants nothing on `POST`/`DELETE`
 * The one exception is an app with no `auth` block at all: there
 * is no session system to gate against, so a public bucket (including the
 * built-in `system` bucket, which resolves to `public: !app.auth`) stays anonymously
 * writable. That carve-out is what keeps page-component file-upload forms
 * working on a no-auth app; it is bounded on purpose, and a DECLARED bucket
 * without `public: true` stays unwritable there (the bucket-permission enforcement rule,
 * a buckets perm spec pins both halves).
 *
 * The way out of the asymmetry is the same explicit lever an auth-enabled app
 * uses: `permissions: { upload: 'all' }`.
 */
export function defaultWriteGrant(
  app: App,
  bucket: Bucket,
  session: UserSession | undefined
): boolean {
  if (bucket.public && !app.auth) return true
  return session !== undefined
}

/**
 * The delete rung of a bucket file: the domain's own decision
 * (`permitsBucketFileDelete`), so the files API and an automation's
 * `file/delete` cannot drift apart. `caller` is `undefined` with no session.
 */
export function deleteGrant(
  app: App,
  bucket: Bucket,
  caller: BucketFileCaller | undefined
): boolean {
  return permitsBucketFileDelete(bucket, caller, { app })
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
