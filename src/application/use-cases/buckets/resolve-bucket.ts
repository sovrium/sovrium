/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which bucket a file request addresses.
 *
 * Every bucket endpoint — download, upload, delete, sign — resolves the bucket
 * the same way, and it has to: the resolution is not a lookup but a POLICY, and
 * a second copy of it would be a second answer to "what may an app with no
 * `buckets[]` block do with its own storage?".
 */

import { AVATAR_BUCKET_NAME, resolveAvatarBucket } from '@/domain/models/app/auth/avatar-url'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { deriveSystemBucketPermissions } from '@/domain/models/app/buckets/system-bucket-permissions'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'

/**
 * Resolve the bucket for a file request: a declared bucket by name, or the
 * built-in `system` bucket — the fallback store of every attachment field that
 * names no `bucket:`, and a name no app may declare.
 *
 * The system bucket is private (`public: false`) when the app declares
 * an `auth` block — writes then require a session. With no auth configured there
 * is no session system to gate against, so it is public, which is what keeps
 * page-component file-upload forms working on a no-auth app.
 *
 * It also inherits the STRICTEST role list the app's DECLARED buckets state for
 * each file action. Without that, an app declaring a single admin-only bucket
 * still exposed every one of its objects to any signed-in caller through this
 * system bucket, because storage keys are flat and carry no bucket — see
 * {@link deriveSystemBucketPermissions} for the full rule and its bounds
 * (the buckets perm specs).
 */
export const resolveUploadBucket = (
  app: App,
  bucketName: string | undefined
): Bucket | undefined => {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  if (bucketName !== SYSTEM_BUCKET_NAME) return undefined
  const permissions = deriveSystemBucketPermissions(app.buckets)
  return permissions === undefined
    ? { name: SYSTEM_BUCKET_NAME, public: !app.auth }
    : { name: SYSTEM_BUCKET_NAME, public: !app.auth, permissions }
}

/**
 * Resolve the bucket a DOWNLOAD reads from: {@link resolveUploadBucket}, then
 * the ENGINE-OWNED avatar bucket, for the one name the engine mints URLs under
 * itself (`POST /api/account/avatar`). Without it an app declaring no bucket
 * would store the object and hand back a URL that 404s.
 *
 * ORDER IS THE FENCE. `resolveUploadBucket` answers FIRST, so a host that
 * declares `avatars` keeps its own bucket and every rule it wrote — its
 * `public` flag and its `permissions.download` included. The fallback is
 * reached only when the host declared nothing, so it can never narrow an app
 * that has been serving public avatars.
 *
 * Reads only, and not inside `resolveUploadBucket` itself: that resolver also
 * serves upload, delete and sign, and teaching it this name would open three
 * write doors on a bucket the host never declared. The files API's download
 * and an automation run judging a stored file for its starter both read here.
 */
export const resolveDownloadBucket = (
  app: App,
  bucketName: string | undefined
): Bucket | undefined =>
  resolveUploadBucket(app, bucketName) ??
  (bucketName === AVATAR_BUCKET_NAME ? resolveAvatarBucket(app.buckets) : undefined)
