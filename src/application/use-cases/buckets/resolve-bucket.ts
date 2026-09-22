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

import { deriveImplicitBucketPermissions } from '@/domain/models/app/buckets/implicit-default-permissions'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'

/**
 * Resolve the bucket for a file request, falling back to an implicit `default`
 * bucket when the config declares none.
 *
 * The implicit default bucket is private (`public: false`) when the app declares
 * an `auth` block — writes then require a session. With no auth configured there
 * is no session system to gate against, so it is public, which is what keeps
 * page-component file-upload forms working on a no-auth app.
 *
 * It also inherits the STRICTEST role list the app's DECLARED buckets state for
 * each file action. Without that, an app declaring a single admin-only bucket
 * still exposed every one of its objects to any signed-in caller through this
 * phantom bucket, because storage keys are flat and carry no bucket — see
 * {@link deriveImplicitBucketPermissions} for the full rule and its bounds
 * (`[internal ref]`/`-017`).
 */
export const resolveUploadBucket = (
  app: App,
  bucketName: string | undefined
): Bucket | undefined => {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  if (bucketName !== 'default') return undefined
  const permissions = deriveImplicitBucketPermissions(app.buckets)
  return permissions === undefined
    ? { name: 'default', public: !app.auth }
    : { name: 'default', public: !app.auth, permissions }
}
