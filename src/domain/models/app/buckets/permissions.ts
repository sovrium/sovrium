/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

// ---------------------------------------------------------------------------
// Bucket Permissions
// ---------------------------------------------------------------------------

/**
 * Bucket Permissions Schema
 *
 * Defines who can perform storage operations on a specific bucket.
 * Uses the shared PermissionValueSchema format: 'all' | 'authenticated' | string[].
 *
 * Every field is optional, and a DECLARED action is enforced while an
 * UNDECLARED one keeps the platform's pre-existing gate:
 *
 * - `upload` / `download` / `delete` — undeclared means "a session is
 *   required"; `download` is additionally short-circuited by `public: true`,
 *   which grants reads and never writes.
 * - `sign` / `signUpload` — undeclared means admin-only.
 *
 * Admin always passes, whatever the declared role list.
 *
 * @example
 * ```yaml
 * buckets:
 *   - name: documents
 *     permissions:
 *       upload: ['admin', 'editor']
 *       download: authenticated
 *       sign: authenticated
 *       signUpload: ['admin', 'editor']
 *       delete: ['admin']
 * ```
 */
export const BucketPermissionsSchema = Schema.Struct({
  /** Who can upload files to this bucket */
  upload: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can upload files to this bucket' })
    )
  ),

  /** Who can download files from this bucket */
  download: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can download files from this bucket' })
    )
  ),

  /** Who can generate signed download URLs for files in this bucket */
  sign: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can generate signed download URLs' })
    )
  ),

  /** Who can generate signed upload URLs for files in this bucket */
  signUpload: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can generate signed upload URLs' })
    )
  ),

  /** Who can delete files from this bucket */
  delete: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can delete files from this bucket' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'BucketPermissions',
    title: 'Bucket Permissions',
    description:
      'Per-bucket permission configuration. Uses the same format as table permissions: all, authenticated, or role array.',
  })
)

/** @public */
export type BucketPermissions = Schema.Schema.Type<typeof BucketPermissionsSchema>

/**
 * Every action a bucket can gate, derived from the schema rather than restated.
 *
 * @public
 */
export type BucketAction = keyof BucketPermissions

/**
 * Which request gate each bucket action belongs to.
 *
 * This exists to make the action set TOTAL at the type level. The schema grew
 * to five actions while only `sign` / `signUpload` were ever consulted, and
 * nothing failed — three permissions sat in the schema, were validated at
 * startup, and did nothing.
 *
 * `satisfies Record<BucketAction, …>` is the load-bearing half: a sixth action
 * added to {@link BucketPermissionsSchema} fails to compile until it is
 * classified here. A `satisfies readonly (keyof BucketPermissions)[]` on the
 * array form alone would catch a RENAME but not an OMISSION — and omission is
 * exactly the defect this guards against.
 *
 * - `read` / `write` — enforced by the file endpoints via `canAct`
 * - `sign` — enforced by the signed-URL endpoints via `canSign`
 */
const BUCKET_ACTION_KIND = {
  upload: 'write',
  download: 'read',
  sign: 'sign',
  signUpload: 'sign',
  delete: 'write',
} as const satisfies Record<BucketAction, 'read' | 'write' | 'sign'>

/**
 * Every declared bucket action, derived from {@link BUCKET_ACTION_KIND}'s keys.
 *
 * Consumed by startup role-name validation so a newly added action is
 * validated the day it is declared, without a second hand-written list.
 *
 * @public
 */
export const BUCKET_ACTIONS = Object.keys(BUCKET_ACTION_KIND) as readonly BucketAction[]

/**
 * The subset of actions the FILE endpoints gate on — every action that is not
 * a signing action. Derived from {@link BUCKET_ACTION_KIND} so a new non-signing
 * action joins the file gate automatically.
 *
 * @public
 */
export type BucketFileAction = {
  [K in BucketAction]: (typeof BUCKET_ACTION_KIND)[K] extends 'sign' ? never : K
}[BucketAction]
