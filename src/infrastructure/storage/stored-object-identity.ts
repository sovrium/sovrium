/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `StorageService.objectIdentity` — each provider's own identity of a stored
 * object, read without downloading it, named by its provider (`s3:`, `local:`,
 * `bytea:`). It must change whenever the bytes at
 * the key may have changed, writes outside Sovrium included, so the catalogue
 * is never part of it:
 *
 * - S3: the `ETag`, the size and `LastModified` of one `HEAD` (Bun's client
 *   reports no `VersionId`), and `none` for an object stamped within
 *   {@link S3_RACY_WINDOW_MS} of the read (or in the future): `LastModified`
 *   keeps whole seconds, so a rewrite of the same size within the same second
 *   could read the same, and the caller hashes the bytes instead. The window
 *   is wide because the stamp comes from the store's clock, not this one;
 * - local disk: the size, the inode, and the modification and change times
 *   at nanosecond resolution — `none` on a mount that keeps whole seconds,
 *   where a rewrite within the same second would read as unchanged, and `none`
 *   for a file written in the last {@link RACY_WINDOW_NS} (or stamped in the
 *   future): a kernel stamps files from a coarse clock, so a rewrite in the
 *   same tick, or a recreated file given the freed inode in that tick, would
 *   read the same. A file older than that window can change only under a
 *   later stamp, so the hash is needed only for the young ones;
 * - database: the payload row's id and the write counter its own upsert bumps,
 *   with the payload length.
 *
 * A key a catalog CLAIM holds (`catalog-claim.ts`) answers `absent` on every
 * provider: its bytes may already be in the store, but until the claim settles
 * they belong to no file, exactly as every other read treats them.
 */

import { stat } from 'node:fs/promises'
import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  StorageError,
  storageObjectNotFound,
  type StoredObjectHash,
  type StoredObjectIdentity,
} from '@/application/ports/services/storage-service'
import { db } from '@/infrastructure/database'
import { isClaimed } from './catalog-claim'
import { resolveStoragePath } from './local-adapter'
import { assertCanonicalS3Key } from './s3-adapter'
import {
  S3_METADATA_TIMEOUT_MS,
  passThrough,
  retryIdempotentS3,
  s3Deadline,
} from './s3-call-policy'

const ABSENT: StoredObjectIdentity = { kind: 'absent' }
const NONE: StoredObjectIdentity = { kind: 'none' }

const identity = (value: string): StoredObjectIdentity => ({ kind: 'identity', value })

/**
 * `read`, answering `absent` while a claim holds `key`. The claim is checked
 * AFTER the store answers: bytes a claim is still writing are never reported,
 * and a claim settled in between leaves the identity of the bytes it settled.
 * The bytea identity needs no wrapper, its query reads settled rows only.
 */
export const absentWhileClaimed =
  (
    key: string,
    read: () => Promise<StoredObjectIdentity>,
    claimed: (key: string) => Promise<boolean> = isClaimed
  ) =>
  async (): Promise<StoredObjectIdentity> => {
    const answer = await read()
    if (answer.kind === 'absent') return answer
    return (await claimed(key)) ? ABSENT : answer
  }

/** Run `read` as the port's effect: a rejection is the store not answering. */
export const storedObjectIdentity = (
  read: () => Promise<StoredObjectIdentity>
): Effect.Effect<StoredObjectIdentity, StorageError> =>
  Effect.tryPromise({ try: read, catch: (cause: unknown) => new StorageError({ cause }) })

const codeOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null
    ? (error as { readonly code?: unknown }).code
    : undefined

/**
 * How recent an S3 object's `LastModified` must be for it not to be trusted, in
 * milliseconds: its whole second, plus room for the store's clock to differ
 * from this one.
 */
export const S3_RACY_WINDOW_MS = 60_000

/** The S3 identity of `key`: one `HEAD`, read at `nowMs`. */
export const s3ObjectIdentity = async (
  client: Bun.S3Client,
  bucket: string,
  key: string,
  nowMs: number = Date.now()
): Promise<StoredObjectIdentity> => {
  assertCanonicalS3Key(key)
  return Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- as `s3StoredSize`: the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({ try: () => client.file(key, { bucket }).stat(), catch: passThrough }),
        s3Deadline('stat', S3_METADATA_TIMEOUT_MS)
      )
    ).pipe(
      Effect.map((stats) => s3IdentityOf(stats, nowMs)),
      Effect.catchIf(
        (error) => codeOf(error) === 'NoSuchKey',
        () => Effect.succeed(ABSENT)
      )
    )
  )
}

/**
 * The identity one `HEAD` answered at `nowMs`; `none` when it carried no `ETag`
 * or no readable `LastModified`, or when the object was stamped within
 * {@link S3_RACY_WINDOW_MS} of `nowMs`, or after it.
 */
const s3IdentityOf = (
  stats: {
    readonly etag?: unknown
    readonly size: number
    readonly lastModified: Date | string | number
  },
  nowMs: number
): StoredObjectIdentity => {
  const etag = typeof stats.etag === 'string' ? stats.etag : ''
  const stamped = new Date(stats.lastModified).getTime()
  if (etag === '' || Number.isNaN(stamped)) return NONE
  if (nowMs - stamped < S3_RACY_WINDOW_MS) return NONE
  return identity(`s3:${etag}:${String(stats.size)}:${new Date(stamped).toISOString()}`)
}

/** How recent a write must be for its stamps not to be trusted: the caller hashes instead. */
export const RACY_WINDOW_NS = 2_000_000_000n

const nowNs = (): bigint => BigInt(Date.now()) * 1_000_000n

/** The local-disk identity of `key`, from a nanosecond `stat`, read at `now` (nanoseconds). */
export const localObjectIdentity = async (
  directory: string,
  key: string,
  now: bigint = nowNs()
): Promise<StoredObjectIdentity> => {
  try {
    const stats = await stat(resolveStoragePath(directory, key), { bigint: true })
    if (!stats.isFile()) return ABSENT
    return localIdentityOf(stats, now)
  } catch (error) {
    if (codeOf(error) === 'ENOENT') return ABSENT
    throw error
  }
}

/**
 * The identity a nanosecond `stat` gives at `now`; `none` when its times keep
 * whole seconds only, or when the file was stamped within {@link RACY_WINDOW_NS}
 * of `now`, or after it.
 */
export const localIdentityOf = (
  stats: {
    readonly size: bigint
    readonly ino: bigint
    readonly mtimeNs: bigint
    readonly ctimeNs: bigint
  },
  now: bigint = nowNs()
): StoredObjectIdentity => {
  const second = 1_000_000_000n
  if (stats.mtimeNs % second === 0n && stats.ctimeNs % second === 0n) return NONE
  const stamped = stats.mtimeNs > stats.ctimeNs ? stats.mtimeNs : stats.ctimeNs
  if (now - stamped < RACY_WINDOW_NS) return NONE
  return identity(
    `local:${String(stats.size)}:${String(stats.ino)}:${String(stats.mtimeNs)}:${String(stats.ctimeNs)}`
  )
}

/** The database identity of `key`: its payload row and that row's write counter. */
export const byteaObjectIdentity = async (key: string): Promise<StoredObjectIdentity> => {
  const rows = (await db.execute(sql`
    SELECT b.id AS id, b.write_count AS writes, octet_length(b.content) AS size
    FROM system.file_storage_bytea b
    JOIN system.file_storage_metadata m ON m.id = b.metadata_id
    WHERE m.key = ${key} AND m.storage_provider = 'bytea'
    LIMIT 1
  `)) as readonly Record<string, unknown>[]
  return byteaIdentityOf(rows)
}

/** The identity a {@link byteaObjectIdentity} query returned; `absent` when no row came back. */
export const byteaIdentityOf = (rows: readonly Record<string, unknown>[]): StoredObjectIdentity => {
  const row = rows[0]
  if (row === undefined) return ABSENT
  return identity(`bytea:${String(row['id'])}:${String(row['writes'])}:${String(row['size'])}`)
}

/**
 * The payload's length and SHA-256, computed by the database: the payload
 * never leaves it, whatever its size. Rejects with the not-found marker when no
 * bytea payload is stored under `key`.
 */
export const byteaHashObject = async (key: string): Promise<StoredObjectHash> => {
  const result = (await db.execute(sql`
    SELECT octet_length(b.content) AS size, encode(sha256(b.content), 'hex') AS sha256
    FROM system.file_storage_bytea b
    JOIN system.file_storage_metadata m ON m.id = b.metadata_id
    WHERE m.key = ${key} AND m.storage_provider = 'bytea'
    LIMIT 1
  `)) as readonly Record<string, unknown>[]
  const row = result[0]
  if (!row) throw storageObjectNotFound(key)
  return { size: Number(row['size']), sha256: String(row['sha256']) }
}
