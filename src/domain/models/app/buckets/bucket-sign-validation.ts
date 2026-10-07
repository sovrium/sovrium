/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  ADMIN_ONLY_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
} from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'

/**
 * Whether a caller with `userRole` may have a signed URL minted for
 * `operation` on `bucket`. The permission entry is `permissions.sign` for
 * download URLs and `permissions.signUpload` for upload URLs; undeclared, it is
 * admin-only.
 *
 * An admin-equivalent caller always passes (admin override): the built-in
 * `admin` and the app's top role. A signed-out caller (`userRole` undefined)
 * passes only the literal `'all'`.
 *
 * One rule for every door that mints a URL: the signed-URL route, and the page
 * that previews a fixed file of a bucket (`file-preview`).
 */
export function canSignBucketUrl(
  bucket: Bucket,
  operation: 'download' | 'upload',
  userRole: string | undefined,
  app: App
): boolean {
  const permission =
    operation === 'upload' ? bucket.permissions?.signUpload : bucket.permissions?.sign
  const caller =
    userRole === undefined
      ? undefined
      : { role: userRole, adminEquivalent: isAdminEquivalent(userRole, app) }
  return permits(
    evaluatePermission(permission, caller, {
      whenUndeclared: ADMIN_ONLY_WHEN_UNDECLARED,
      adminOverride: 'admin-outranks-role-list',
    })
  )
}
