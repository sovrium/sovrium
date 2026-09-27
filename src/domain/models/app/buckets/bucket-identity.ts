/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Identity of the buckets an app exposes, shared by the admin bucket list and
 * the storage overview so the two cannot disagree about what a bucket is.
 *
 * A bucket is a DECLARATION (`app.buckets[]`), not a storage backend. The env
 * resolves exactly one backend, and a stored object records the bucket it was
 * written through. Every app also carries the built-in `system` bucket, listed
 * FIRST beside its declarations: it is the store of every attachment field that
 * names no `bucket:`, and the view of every file linked to a record, whichever
 * bucket holds it. `system` is a reserved name no app may declare.
 *
 * Buckets have no persisted row, so their ids are derived from their names:
 * stable across restarts (the dashboard's bucket-detail links stay bookmarkable)
 * and distinct per name (three declared buckets are three different pages).
 */

import { createHash } from 'node:crypto'

/** Name of the built-in bucket every app carries. Reserved: no app may declare it. */
export const SYSTEM_BUCKET_NAME = 'system'

/** Whether `name` is the built-in system bucket's reserved name. */
export function isSystemBucketName(name: string): boolean {
  return name === SYSTEM_BUCKET_NAME
}

/**
 * Id of the built-in `system` bucket. It is the `resource.id` of the audit
 * entries that touch the system bucket itself, and of the aggregate entries
 * that span every bucket (the bucket list and the overview); an entry about one
 * declared bucket carries that bucket's own id ({@link bucketIdForName}).
 *
 * Fixed rather than derived: it shipped as this literal (under the bucket's
 * former name, `default`), and audit entries already reference it.
 */
export const SYSTEM_BUCKET_ID = '00000000-0000-4000-8000-000000000001'

/**
 * Derive a bucket's stable id from its name.
 *
 * A SHA-256 of the name, formatted as a v4-shaped UUID (version nibble `4`,
 * variant nibble `8`) so it satisfies the response schema's `uuid()` contract.
 * The shape is cosmetic — what matters is that the same declaration always
 * yields the same id and two declarations never collide.
 *
 * The built-in `system` bucket keeps {@link SYSTEM_BUCKET_ID}: it is already
 * published in audit entries.
 */
export function bucketIdForName(name: string): string {
  if (name === SYSTEM_BUCKET_NAME) return SYSTEM_BUCKET_ID
  const hex = createHash('sha256').update(`sovrium:bucket:${name}`).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

/**
 * The names of the buckets an app exposes: the built-in `system` bucket FIRST,
 * then every declaration in `app.buckets[]` in declaration order.
 */
export function declaredBucketNames(
  buckets: ReadonlyArray<{ readonly name: string }> | undefined
): ReadonlyArray<string> {
  return [SYSTEM_BUCKET_NAME, ...(buckets ?? []).map((bucket) => bucket.name)]
}
