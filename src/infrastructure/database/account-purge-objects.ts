/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The storage half of an erasure: the catalog rows of the objects she uploaded,
 * deleted inside the transaction, and the objects a committed erasure leaves in
 * the blob store, removed after the commit (`account-purge.ts` runs the rest).
 */

import { eq, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { AVATAR_BUCKET_NAME, avatarStorageKeyFromUrl } from '@/domain/models/app/auth/avatar-url'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { Database, type DatabaseService } from '@/infrastructure/database/drizzle/layer'
import { logError } from '@/infrastructure/logging/logger'
import { closeUserConnections, SESSION_ENDED } from '@/infrastructure/realtime/connection-counter'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { executeRawOn } from './sql/dialect-execute'
import { withPromiseTransaction } from './transaction'
import type { PortableTx } from '@/infrastructure/database'

// The erasure's storage step runs with no runtime in hand (it is called as a
// promise), so its catalog is read through the database the erasure runs on.
const erasureStorageLive = (database: DatabaseService) =>
  Layer.provide(StorageServiceLive, Layer.succeed(Database, database))

/**
 * The user's stored `auth.user.image`, read BEFORE the erasure transaction runs.
 *
 * The purge deletes the row, so this value is unrecoverable afterwards. Since
 * every upload road records its uploader, the catalog names a NEW avatar as
 * hers like any other file (its key comes back from the census sweep); this
 * column remains the only handle on an avatar uploaded before it did, whose
 * catalog row carries no uploader.
 */
export async function readStoredAvatarImage(
  { client: db, dialect }: DatabaseService,
  userId: string
): Promise<string | null> {
  const rows = (await executeRawOn(
    dialect.kind,
    db,
    sql`SELECT image FROM ${dialect.sql.authTableRef('user')} WHERE id = ${userId}`
  )) as readonly { image: string | null }[]
  return rows[0]?.image ?? null
}

/**
 * Delete the erased user's avatar object from the blob store.
 *
 * Runs AFTER the transaction commits, deliberately. Storage is not
 * transactional, so a delete issued inside the transaction would be permanent
 * even if the transaction then rolled back — erasing the file of an account
 * that still exists. Committing first means the worst case is the opposite and
 * far safer one: a row that is gone and an object that is not, which the log
 * line below makes findable.
 *
 * The transform-cache eviction is not housekeeping either. `serveFileDownload`
 * answers from a process-local LRU before it ever reaches storage, so any avatar
 * that has been fetched once would keep being served over HTTP after erasure —
 * retained personal data (Art. 17) that no amount of SQL would remove.
 *
 * A value the instance did not issue (a legacy external URL) names no local
 * object and is skipped.
 */
export async function removeErasedAvatarObject(
  database: DatabaseService,
  userId: string,
  image: string | null
): Promise<void> {
  const key = avatarStorageKeyFromUrl(image)
  if (key === undefined) return

  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    // Bracket notation dodges a `drizzle/enforce-delete-with-where` false
    // positive on the storage port's `delete` — same workaround as `buckets.ts`.
    yield* storage['delete'](key, AVATAR_BUCKET_NAME)
  }).pipe(Effect.provide(erasureStorageLive(database)), Effect.result)

  const result = await Effect.runPromise(program)
  if (result._tag === 'Failure') {
    logError(`[account-purge] avatar object ${key} survived erasure of ${userId}`, result.failure)
  }
  evictTransformCacheForKey(key)
}

/**
 * Remove the stored bytes of every object the erased person uploaded.
 *
 * The keys are those of exactly the catalog rows the transaction's census
 * sweep deleted (`DELETE … RETURNING key`), so a file stored while the erasure
 * was starting is among them — on the database-backed provider the payload
 * cascades with the row, so this has nothing left to do there. On the local
 * filesystem and an object store the bytes outlive the row, and they are
 * deleted here, AFTER the commit, for the reason set out on
 * {@link removeErasedAvatarObject}: a rolled-back erasure must never destroy a
 * file.
 *
 * One object a store refuses does not keep the others: each failure is logged
 * by key — an unreachable object an operator can find and remove — and the
 * sweep goes on. Every key's cached transforms are evicted either way, because
 * the download path answers from that cache before it reaches storage.
 */
export async function removeErasedObjects(
  database: DatabaseService,
  userId: string,
  keys: readonly string[]
): Promise<void> {
  if (keys.length === 0) return
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* Effect.forEach(
      keys,
      (key) =>
        storage.deleteUncataloguedBytes(key).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() => {
              logError(`[account-purge] object ${key} survived erasure of ${userId}`, cause)
            })
          ),
          // effect-swallow: see the tap above. The erasure is already committed;
          // one object a store refuses must not keep the rest, and the log line
          // names its key so an operator can remove it.
          Effect.ignore
        ),
      { discard: true }
    )
  }).pipe(Effect.provide(erasureStorageLive(database)), Effect.result)

  const result = await Effect.runPromise(program)
  if (result._tag === 'Failure') {
    logError(
      `[account-purge] storage unavailable: ${keys.length} object(s) of ${userId} survived erasure`,
      result.failure
    )
  }
  keys.forEach(evictTransformCacheForKey)
}

/**
 * Delete the catalog rows of every object the erased user uploaded, and answer
 * the keys of exactly the rows deleted (`DELETE … RETURNING key`, on both
 * dialects). Those keys are what the bytes are removed by after the commit
 * ({@link removeErasedObjects}): read anywhere else — before the transaction,
 * say — a file she uploaded in between would lose its row here and keep its
 * bytes, unreachable, after an Art. 17 erasure.
 */
export async function deleteCatalogRows(
  tx: Readonly<PortableTx>,
  userId: string
): Promise<readonly string[]> {
  const files = fileStorageMetadataTable()
  const rows = await tx
    .delete(files)
    .where(eq(files.uploadedById, userId))
    .returning({ key: files.key })
  return rows.map((row) => row.key)
}

/**
 * The two edges of an erasure a test needs to hold: the transaction the rows
 * are deleted in, and the post-commit port that removes the bytes. Live, they
 * are the one transaction door (`withPromiseTransaction`, whose body's own
 * rejection — the last-admin rail's refusal among them — comes back verbatim)
 * and {@link removeErasedObjects}, both on the database the erasure runs on,
 * which the seams carry.
 */
export interface ErasureSeams {
  /** The database the erasure reads the account from and stores its catalog in. */
  readonly database: DatabaseService
  readonly inTransaction: <T>(body: (tx: Readonly<PortableTx>) => Promise<T>) => Promise<T>
  readonly removeObjects: (userId: string, keys: readonly string[]) => Promise<void>
}

export const liveErasureSeams = (database: DatabaseService): ErasureSeams => ({
  database,
  inTransaction: (body) =>
    Effect.runPromise(withPromiseTransaction(database.client, body, (cause) => cause)),
  removeObjects: (userId, keys) => removeErasedObjects(database, userId, keys),
})

/**
 * What follows a committed erasure. The account's live realtime connections
 * are closed — an erased account reads nothing more, rather than until its
 * socket happens to drop — with the session-ended code, since its sessions
 * went with it (by cascade, so no session-delete hook saw them); then every
 * object she uploaded loses its bytes (`removeErasedObjects`), and the
 * avatar her profile pointed at is shed if the catalog did not already name it
 * as hers — post-commit, for the reason given on {@link removeErasedAvatarObject}.
 */
export async function settleCommittedErasure(
  userId: string,
  held: { readonly image: string | null; readonly objectKeys: readonly string[] },
  seams: ErasureSeams
): Promise<void> {
  closeUserConnections(userId, SESSION_ENDED)
  await seams.removeObjects(userId, held.objectKeys)
  const avatarKey = avatarStorageKeyFromUrl(held.image)
  // An avatar uploaded since uploaders are recorded is among `objectKeys` (the
  // keys of the catalog rows the transaction deleted), and its row is gone: a
  // second, catalog-bound delete would only log a false "survived". One stored
  // before carries no uploader and is still reached through the profile column
  // alone.
  if (avatarKey === undefined || held.objectKeys.includes(avatarKey)) return
  await removeErasedAvatarObject(seams.database, userId, held.image)
}
