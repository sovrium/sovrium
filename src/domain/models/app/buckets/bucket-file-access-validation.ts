/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  classifyPermissionRung,
  evaluatePermission,
  grantWhenUndeclared,
  permits,
  SESSION_WITH_UNRESOLVED_ROLE,
  type PermissionCaller,
} from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'
import type { Bucket } from '@/domain/models/app/buckets'

/**
 * Who acts on a bucket file. `undefined` (wherever a `BucketFileCaller |
 * undefined` appears) is nobody signed in. A caller without a `role` is a
 * session whose role was not looked up: every rung but a role list is decided
 * by session presence alone (see {@link bucketPermissionNeedsRole}), and an
 * unresolved role matches no role list.
 */
export interface BucketFileCaller {
  readonly role?: string
}

/** Whether `permission` is a role list, the one rung that reads the caller's role. */
export const bucketPermissionNeedsRole = (permission: PermissionValue | undefined): boolean =>
  classifyPermissionRung(permission) === 'roles'

/**
 * Whether `caller` may perform a bucket file action whose declared permission
 * is `permission`. An undeclared permission falls back to `undeclaredGrant`,
 * the gate the platform applies by default for that action; an
 * admin-equivalent caller (the built-in `admin`, or the app's top role)
 * passes a declared role list; a caller nobody signed in passes only `'all'`.
 */
export const permitsBucketFileAction = (
  permission: PermissionValue | undefined,
  caller: BucketFileCaller | undefined,
  input: { readonly undeclaredGrant: boolean; readonly app: App }
): boolean => {
  const judged: PermissionCaller | undefined =
    caller === undefined
      ? undefined
      : caller.role === undefined
        ? SESSION_WITH_UNRESOLVED_ROLE
        : { role: caller.role, adminEquivalent: isAdminEquivalent(caller.role, input.app) }
  return permits(
    evaluatePermission(permission, judged, {
      whenUndeclared: grantWhenUndeclared(input.undeclaredGrant),
      adminOverride: 'admin-outranks-role-list',
    })
  )
}

/**
 * Whether a stored file is served to anyone: its bucket is public, or its key
 * is (`keyIsPublic`: the operator's `STORAGE_PUBLIC_PATHS` /
 * `STORAGE_DEFAULT_ACCESS` marks it so). A public file skips the `download`
 * permission altogether.
 */
export const isPublicBucketFile = (bucket: Bucket, keyIsPublic: boolean): boolean =>
  bucket.public === true || keyIsPublic

/**
 * THE read rung of a bucket file: whether `caller` may download a file of
 * `bucket`. A public file admits everyone; otherwise the bucket's `download`
 * permission decides, and an undeclared one asks for a session.
 */
export const permitsBucketFileRead = (
  bucket: Bucket,
  caller: BucketFileCaller | undefined,
  input: { readonly app: App; readonly keyIsPublic: boolean }
): boolean =>
  isPublicBucketFile(bucket, input.keyIsPublic) ||
  permitsBucketFileAction(bucket.permissions?.download, caller, {
    undeclaredGrant: caller !== undefined,
    app: input.app,
  })

/**
 * THE delete rung of a bucket file, as the files API judges it: whether
 * `caller` may delete a file of `bucket`. `public` confers no write: an
 * undeclared `delete` asks for a session, except on a public bucket of an app
 * without sign-in, where there is no session to ask for. The per-object rule
 * of an undeclared `delete` (only its uploader, or an admin) is
 * `mayReplaceOrRemoveObject`'s, judged on top.
 */
export const permitsBucketFileDelete = (
  bucket: Bucket,
  caller: BucketFileCaller | undefined,
  input: { readonly app: App }
): boolean =>
  permitsBucketFileAction(bucket.permissions?.delete, caller, {
    undeclaredGrant:
      caller !== undefined || (bucket.public === true && input.app.auth === undefined),
    app: input.app,
  })
