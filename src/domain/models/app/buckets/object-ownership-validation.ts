/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who may delete or replace one stored object.
 *
 * A bucket's `permissions` decide per BUCKET. When a bucket declares no
 * `delete` (or no `upload`), "any signed-in caller" would let every member
 * delete or overwrite every other member's files by key — and keys are not
 * secret: the upload response returns them and record URLs publish them. So
 * that fallback is per OBJECT: the person the catalog records as its uploader,
 * or an admin.
 *
 * Only the UNDECLARED fallback is per object. A declared grant —
 * `'authenticated'`, `'all'`, a role list — keeps meaning exactly what it
 * says, so an app that wants any member to delete any file writes
 * `delete: 'authenticated'`.
 */

import type { BucketFileAction } from './permissions'

/** The two bucket actions that can destroy an object somebody else stored. */
export type ObjectReplacingAction = Extract<BucketFileAction, 'delete' | 'upload'>

/**
 * Whether the owner-or-admin rule governs `action` on this bucket: the bucket
 * leaves the action undeclared AND the app has sign-in. An app without `auth`
 * has no identity to own anything, so its writes keep their bucket-level gate.
 */
export const ownershipGovernsAction = (input: {
  readonly permissions: Readonly<Partial<Record<BucketFileAction, unknown>>> | undefined
  readonly action: ObjectReplacingAction
  readonly appHasAuth: boolean
}): boolean => input.appHasAuth && input.permissions?.[input.action] === undefined

/**
 * Whether the caller may delete or overwrite an object, given who uploaded it.
 *
 * An admin always may. Anyone else may only when the catalog records them as
 * the uploader; an object with NO recorded uploader (stored before uploaders
 * were recorded, or by a road with nobody behind it) belongs to nobody a member
 * could prove to be, so it is an admin's alone.
 */
export const mayReplaceOrRemoveObject = (input: {
  readonly uploadedBy: string | undefined
  readonly callerId: string
  readonly callerIsAdmin: boolean
}): boolean =>
  input.callerIsAdmin || (input.uploadedBy !== undefined && input.uploadedBy === input.callerId)
