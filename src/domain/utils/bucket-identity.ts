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
 * resolves exactly one backend; declared buckets are path prefixes inside it.
 * An app that declares none still addresses storage through the virtual
 * `default` bucket, which is why the fallback exists — but a fallback for an app
 * that declared nothing is not a fourth bucket alongside three that were
 * declared, so the two cases are exclusive.
 *
 * Buckets have no persisted row, so their ids are derived from their names:
 * stable across restarts (the dashboard's bucket-detail links stay bookmarkable)
 * and distinct per name (three declared buckets are three different pages).
 */

import { createHash } from 'node:crypto'

/** Name of the virtual bucket an app that declares none still uploads through. */
export const DEFAULT_BUCKET_NAME = 'default'

/**
 * Id of the virtual `default` bucket, and the `resource.id` every bucket-domain
 * audit entry carries.
 *
 * Fixed rather than derived: it shipped as this literal, and audit entries
 * already reference it.
 */
export const DEFAULT_BUCKET_ID = '00000000-0000-4000-8000-000000000001'

/**
 * Derive a bucket's stable id from its name.
 *
 * A SHA-256 of the name, formatted as a v4-shaped UUID (version nibble `4`,
 * variant nibble `8`) so it satisfies the response schema's `uuid()` contract.
 * The shape is cosmetic — what matters is that the same declaration always
 * yields the same id and two declarations never collide.
 *
 * The virtual `default` bucket keeps {@link DEFAULT_BUCKET_ID}: it is already
 * published in audit entries and dashboard links.
 */
export function bucketIdForName(name: string): string {
  if (name === DEFAULT_BUCKET_NAME) return DEFAULT_BUCKET_ID
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
 * The names of the buckets an app exposes: every declaration in `app.buckets[]`,
 * or the single virtual `default` bucket when it declares none.
 */
export function declaredBucketNames(
  buckets: ReadonlyArray<{ readonly name: string }> | undefined
): ReadonlyArray<string> {
  if (buckets === undefined || buckets.length === 0) return [DEFAULT_BUCKET_NAME]
  return buckets.map((bucket) => bucket.name)
}
