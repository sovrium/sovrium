/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The accounts and the file buckets of a source that has its own (Supabase):
 * the report's `auth` section, and the `buckets:` entries with the files each
 * one is seeded with.
 *
 * - **Accounts** carry no password: the source's hashes cannot be verified
 *   here, so the report says so once and counts who has to set one.
 * - **A bucket** keeps its visibility, its size limit and its accepted types,
 *   under a Sovrium bucket name (lower case, hyphens). Each downloaded object is
 *   written at `<bucket>/<path>`; an object whose path would leave its bucket
 *   folder, or whose bytes were not downloaded, is counted as skipped.
 */

import type { CanonicalBase } from './canonical-base'
import type { ConfigEntry } from './field-settings-service'
import type { ImportReport } from './import-report'

type AuthSection = NonNullable<ImportReport['auth']>
type BucketsSection = NonNullable<ImportReport['buckets']>
type Bucket = NonNullable<CanonicalBase['buckets']>[number]

/** The report's `auth` section, or `undefined` when the source has no accounts of its own. */
export const authSectionOf = (base: CanonicalBase): AuthSection | undefined => {
  if (base.skippedUsers === undefined) return undefined
  const invitations = base.users.filter((user) => user.state === 'invited').length
  const accounts = base.users.length - invitations
  return {
    accounts,
    invitations,
    skipped: base.skippedUsers.map(({ reason, count }) => ({ reason, count })),
    passwords: 'not-imported',
    message:
      `No password was carried over: the source's password hashes cannot be verified here, so each of the ${String(accounts)} ` +
      `account${accounts === 1 ? '' : 's'} sets a password by resetting it, and each invited person by accepting the invitation.`,
  }
}

/** A source bucket name as a Sovrium one: lower case, letters, digits and hyphens, a letter first. */
export const bucketNameOf = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const named = /^[a-z]/.test(slug) ? slug : `bucket-${slug}`.replace(/-$/, '')
  return named === 'system' ? 'system-import' : named.slice(0, 63).replace(/-$/, '')
}

/** Whether an object path stays inside its bucket folder: plain segments, none `.` or `..`. */
const isSafePath = (path: string): boolean =>
  !path.includes('\\') &&
  !path.includes('\0') &&
  path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')

/** One object to seed: its bytes in the snapshot, and where it goes in its bucket. */
export interface BucketFileCopy {
  /** In the snapshot: `assets/<sha256>.<ext>`. */
  readonly from: string
  /** The Sovrium bucket name. */
  readonly bucket: string
  /** The path inside the bucket, as the source named it. */
  readonly path: string
}

/** The buckets of a source as `buckets:` entries, their files, and the report section. */
export interface BucketPlan {
  readonly entries: readonly ConfigEntry[]
  readonly files: readonly BucketFileCopy[]
  readonly section: BucketsSection
}

const entryOf = (bucket: Bucket, name: string): ConfigEntry => ({
  name,
  public: bucket.public,
  ...(bucket.maxFileSize === undefined ? {} : { maxFileSize: bucket.maxFileSize }),
  ...(bucket.allowedMimeTypes === undefined ? {} : { allowedMimeTypes: bucket.allowedMimeTypes }),
})

/** Plan the buckets of a base, or `undefined` when the source has none. */
export const planBuckets = (
  base: CanonicalBase,
  storagePolicies: readonly string[]
): BucketPlan | undefined => {
  if (base.buckets === undefined) return undefined
  const planned = base.buckets.map((bucket) => {
    const name = bucketNameOf(bucket.name)
    const files = bucket.objects.flatMap((object) =>
      object.asset === undefined || !isSafePath(object.path)
        ? []
        : [{ from: object.asset, bucket: name, path: object.path }]
    )
    return { bucket, name, files }
  })
  return {
    entries: planned.map(({ bucket, name }) => entryOf(bucket, name)),
    files: planned.flatMap((one) => one.files),
    section: {
      created: planned.map(({ bucket, name, files }) => ({
        name,
        source: bucket.name,
        public: bucket.public,
        files: files.length,
        skipped: bucket.objects.length - files.length,
      })),
      storagePolicies,
    },
  }
}
