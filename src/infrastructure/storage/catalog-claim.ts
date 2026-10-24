/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A catalog CLAIM: the row a replacing write onto a free key inserts BEFORE it
 * stores its bytes, so a create-only write racing it loses the row race instead
 * of ending up described by a row holding the other writer's bytes.
 *
 * A claim is an ordinary `file_storage_metadata` row whose `storage_provider`
 * carries {@link CLAIM_PROVIDER_PREFIX}. Until its bytes are stored it is
 * invisible: catalog reads, store listings and downloads treat its key as
 * absent. Once the bytes are stored the claim is SETTLED — its provider becomes
 * the real one. A claim whose writer died before settling it is released by
 * the next write to its key once it is older than {@link CLAIM_STALE_AFTER_MS},
 * so a crash never blocks a key for good.
 *
 * Every claim carries its own writer's token in its marker, and settling or
 * releasing one is a conditional update on that exact marker. A writer slow
 * enough to see its claim released as stale, and the key claimed again by a
 * later writer, therefore finds no row to settle and refuses: it never settles
 * the later writer's claim, and the key is settled at most once per claim.
 * What the margin alone bounds is the store: such a writer's bytes may already
 * have landed, which is why {@link CLAIM_STALE_AFTER_MS} sits far above the
 * longest bounded data call.
 *
 * {@link isClaim} is the ONE spelling of "this row is a claim"; every reader
 * of the catalog that must not see one goes through it or {@link notClaimed}.
 */

import { and, eq, inArray, like, lt, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'

/** The `storage_provider` prefix of a row whose bytes are not stored yet. */
export const CLAIM_PROVIDER_PREFIX = 'claim:'

/**
 * How old a claim may get before the next write to its key releases it. A
 * replacing write settles its claim as soon as its bytes are stored, and one
 * S3 data call is bounded at two minutes with its retries: a claim older than
 * this has no living writer.
 */
export const CLAIM_STALE_AFTER_MS = 15 * 60_000

/**
 * The `storage_provider` a claim made for `provider` (`local`, `s3`) by the
 * writer holding `token` records: the marker its settle and release match.
 */
export const claimProviderOf = (provider: string, token: string): string =>
  `${CLAIM_PROVIDER_PREFIX}${provider}:${token}`

/** The condition that holds for a claim, whoever's: the one test of "is a claim". */
export const isClaim = (): SQL => {
  const files = fileStorageMetadataTable()
  return like(files.storageProvider, `${CLAIM_PROVIDER_PREFIX}%`)
}

/** The condition that leaves out every claim: what a reader of the catalog adds. */
export const notClaimed = (): SQL => sql`not (${isClaim()})`

/** Release every claim at `key` older than {@link CLAIM_STALE_AFTER_MS}, as of `nowMs`. */
export const releaseStaleClaim = async (key: string, nowMs: number): Promise<void> => {
  const files = fileStorageMetadataTable()
  await db
    .delete(files)
    .where(
      and(
        eq(files.key, key),
        isClaim(),
        lt(files.createdAt, new Date(nowMs - CLAIM_STALE_AFTER_MS))
      )
    )
}

/** Whether the row at `key` is a claim that has not been settled. */
export const isClaimed = async (key: string): Promise<boolean> => {
  const files = fileStorageMetadataTable()
  const rows = await db
    .select({ key: files.key })
    .from(files)
    .where(and(eq(files.key, key), isClaim()))
    .limit(1)
  return rows.length > 0
}

/** One writer's claim: the key, the provider it settles to, and its own marker. */
export interface CatalogClaim {
  readonly key: string
  readonly provider: string
  readonly marker: string
}

/**
 * The claim becomes an ordinary row; `false` when it is no longer there. The
 * update matches the claim's own marker, so a claim released as stale and
 * taken again by another writer is never settled by this one.
 */
export const settleClaim = async (claim: CatalogClaim): Promise<boolean> => {
  const files = fileStorageMetadataTable()
  const settled = await db
    .update(files)
    .set({ storageProvider: claim.provider })
    .where(and(eq(files.key, claim.key), eq(files.storageProvider, claim.marker)))
    .returning({ key: files.key })
  return settled.length > 0
}

/** Remove the claim, and only it: its bytes could not be stored. */
export const releaseClaim = async (claim: CatalogClaim): Promise<void> => {
  const files = fileStorageMetadataTable()
  await db
    .delete(files)
    .where(and(eq(files.key, claim.key), eq(files.storageProvider, claim.marker)))
}

/**
 * Remove the row a claim settled into: its bytes were staged but could not be
 * moved to the key, so the row would describe a file that is not there.
 */
export const withdrawSettledClaim = async (claim: CatalogClaim): Promise<void> => {
  const files = fileStorageMetadataTable()
  await db
    .delete(files)
    .where(and(eq(files.key, claim.key), eq(files.storageProvider, claim.provider)))
}

/** How many keys one claim lookup binds: well under every dialect's parameter limit. */
const CLAIM_LOOKUP_CHUNK = 500

/** The keys among `chunk` a claim holds. */
const claimedAmong = async (chunk: readonly string[]): Promise<readonly string[]> => {
  const files = fileStorageMetadataTable()
  const rows = await db
    .select({ key: files.key })
    .from(files)
    .where(and(inArray(files.key, [...chunk]), isClaim()))
  return rows.map((row) => row.key)
}

/** `keys` without the ones a claim holds: a listing names no file whose bytes are not stored. */
export const withoutClaimedKeys = async (keys: readonly string[]): Promise<readonly string[]> => {
  const chunks = Array.from({ length: Math.ceil(keys.length / CLAIM_LOOKUP_CHUNK) }, (_, n) =>
    keys.slice(n * CLAIM_LOOKUP_CHUNK, (n + 1) * CLAIM_LOOKUP_CHUNK)
  )
  const held = new Set((await Promise.all(chunks.map(claimedAmong))).flat())
  return held.size === 0 ? keys : keys.filter((key) => !held.has(key))
}
