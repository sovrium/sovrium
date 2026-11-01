/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — planning the parts of a source that brings its own
 * accounts and file buckets (Supabase): `auth`, the accounts seeded with no
 * password, and `buckets`, the `buckets:` entries and the files they are seeded
 * with. Row-level security is not a part of its own: it is written with the
 * tables (`withRowSecurity`, in the table part).
 */

import {
  authSectionOf,
  planBuckets,
  type BucketFileCopy,
  type BucketPlan,
} from '@/domain/models/import/accounts-buckets-mapper-service'
import { planAccountSeed, type SeedPlan } from '@/domain/models/import/seed-emission-service'
import { listOf, partition, refuseClashes } from './plan-merge'
import type { SourceRead } from './sources'
import type { ImportReport } from '@/domain/models/import/import-report'
import type { ImportDomain } from '@/domain/models/import/import-source'
import type { ConfigEntry } from '@/domain/models/import/table-mapper-service'

/** The parts a source provides beyond its tables: its own accounts, its buckets. */
export const accessDomainsOf = (source: SourceRead): readonly ImportDomain[] => {
  const base = source.tables?.base
  return [
    ...(base?.skippedUsers === undefined ? [] : (['auth'] as const)),
    ...(base?.buckets === undefined ? [] : (['buckets'] as const)),
  ]
}

/**
 * The accounts alone, for a run that imports `auth` without the records: with
 * the records, the table part's seed already carries them.
 */
export const accountSeedOf = (
  source: SourceRead,
  domains: readonly ImportDomain[]
): SeedPlan | undefined => {
  const base = source.tables?.base
  return base?.skippedUsers === undefined || !domains.includes('auth')
    ? undefined
    : planAccountSeed(base)
}

/** What the accounts and buckets parts add. */
export interface AccessPart {
  readonly buckets: readonly ConfigEntry[]
  readonly bucketFiles: readonly BucketFileCopy[]
  readonly sections: Pick<ImportReport, 'auth' | 'buckets'>
}

/** The buckets to add, those the config holds unchanged left out; a different one is a clash. */
const bucketsToAdd = (planned: BucketPlan | undefined, parsed: unknown): readonly ConfigEntry[] => {
  if (planned === undefined) return []
  const split = partition(planned.entries, listOf(parsed, 'buckets'), (entry) =>
    JSON.stringify(entry)
  )
  refuseClashes('bucket', split.clashes)
  return split.add
}

/** The report sections of the parts that ran. */
const sectionsOf = (
  auth: ImportReport['auth'],
  buckets: BucketPlan | undefined
): AccessPart['sections'] => ({
  ...(auth === undefined ? {} : { auth }),
  ...(buckets === undefined ? {} : { buckets: buckets.section }),
})

/** Plan the accounts section and the buckets, as `--only` narrows them. */
export const planAccessPart = (
  source: SourceRead,
  parsed: unknown,
  domains: readonly ImportDomain[]
): AccessPart => {
  const read = source.tables
  if (read === undefined) return { buckets: [], bucketFiles: [], sections: {} }
  const auth = domains.includes('auth') ? authSectionOf(read.base) : undefined
  const buckets = domains.includes('buckets')
    ? planBuckets(read.base, read.storagePolicies ?? [])
    : undefined
  return {
    buckets: bucketsToAdd(buckets, parsed),
    bucketFiles: buckets === undefined ? [] : buckets.files,
    sections: sectionsOf(auth, buckets),
  }
}
