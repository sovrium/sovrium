/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find the stored key another spelling of a key would land on.
 *
 * The comparison itself is the domain's ({@link isSecondStorageKeySpelling}),
 * and neither SQL dialect can run it: SQLite has no Unicode normalisation and
 * PostgreSQL's `lower` follows the database collation. So the catalog is
 * narrowed in SQL by a pattern every second spelling is guaranteed to match,
 * and the survivors are compared exactly here.
 */

import { and, gte, ne, or, sql } from 'drizzle-orm'
import {
  isSecondStorageKeySpelling,
  storageKeyCollisionForm,
  type StorageKeyComparison,
} from '@/domain/kernel/identity/storage-key'
import { db } from '@/infrastructure/database'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { CLAIM_PROVIDER_PREFIX, CLAIM_STALE_AFTER_MS } from './catalog-claim'
import type { StoredSpelling } from '@/application/ports/services/storage-service'

/**
 * Characters kept verbatim in the narrowing pattern: ASCII letters and digits
 * and the separators `-`, `.`, `/` and space. No other character normalises or
 * lower-cases onto one of them, so a second spelling holds each of them, in
 * order. `i` and `k` are left out because `İ` lower-cases to `i` + U+0307 and
 * the Kelvin sign to `k`, and NFC rewrites that sign to `K`. Everything else
 * (including the LIKE metacharacters `%`, `_` and `\`) becomes a wildcard.
 */
const VERBATIM = /^[a-hjl-z0-9 ./-]$/i

/**
 * The `LIKE` pattern, lower-cased, that the lower-cased text of every second
 * spelling of `key` matches. It over-matches by design; the exact comparison
 * runs afterwards.
 *
 * Built from the case-FOLDED comparison form, whatever the store: folding can
 * compose a letter with the mark after it (`J` + U+030C has no upper-case
 * precomposed form, while `j` + U+030C composes to `ǰ`), so a pattern built from
 * the unfolded form would ask for a literal `j` a stored `ǰ` does not contain.
 * The folded form is a superset of the unfolded one, so it serves both.
 */
export const secondSpellingPattern = (key: string): string =>
  Array.from(storageKeyCollisionForm(key, { caseInsensitive: true }))
    .map((character) => (VERBATIM.test(character) ? character.toLowerCase() : '%'))
    .join('')
    .replace(/%+/g, '%')

/**
 * The two lower-cased `storage_provider` values a row of `provider` may carry:
 * the provider's own name, and the `LIKE` pattern of a claim a writer holds
 * for it (`claim:<provider>:<token>`, see `catalog-claim.ts`) while its bytes
 * are on their way. A claim is a key being written right now, so it is a
 * spelling a second write would land on just as much as a stored row. The
 * name is matched without regard to case or surrounding space; `\` escapes
 * the `LIKE` metacharacters a provider name could hold.
 */
export const providerSpellings = (
  provider: string
): { readonly name: string; readonly claimPattern: string } => {
  const name = provider.trim().toLowerCase()
  const escaped = name.replace(/[\\%_]/g, (character) => `\\${character}`)
  return { name, claimPattern: `${CLAIM_PROVIDER_PREFIX}${escaped}:%` }
}

/**
 * The catalog row, other than `key` itself, that names the object a write at
 * `key` would land on for this provider; `undefined` when none does.
 *
 * A claim counts only while its writer may still be alive: one older than
 * {@link CLAIM_STALE_AFTER_MS} as of `nowMs` was left by a writer that died,
 * and is released only by the next write to its OWN key, so counting it here
 * would hold every other spelling of that key for good.
 */
export const findOtherStoredSpelling = async (
  key: string,
  store: Readonly<StorageKeyComparison & { readonly provider: string }>,
  nowMs: number
): Promise<StoredSpelling | undefined> => {
  const files = fileStorageMetadataTable()
  const provider = providerSpellings(store.provider)
  const rows = await db
    .select({ key: files.key, bucket: files.bucket, uploadedBy: files.uploadedById })
    .from(files)
    .where(
      and(
        or(
          sql`lower(trim(${files.storageProvider})) = ${provider.name}`,
          and(
            sql`lower(${files.storageProvider}) like ${provider.claimPattern} escape '\\'`,
            gte(files.createdAt, new Date(nowMs - CLAIM_STALE_AFTER_MS))
          )
        ),
        ne(files.key, key),
        sql`lower(${files.key}) like ${secondSpellingPattern(key)}`
      )
    )
  const match = rows.find((row) => isSecondStorageKeySpelling(row.key, key, store))
  if (match === undefined) return undefined
  return {
    key: match.key,
    ...(match.bucket === null ? {} : { bucket: match.bucket }),
    ...(match.uploadedBy === null ? {} : { uploadedBy: match.uploadedBy }),
  }
}
