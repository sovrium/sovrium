/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import {
  parseDatabaseDialectConfig,
  type DatabaseDialect,
} from '@/domain/models/process-env/database/database-dialect'
import { setActiveDialectKind } from './active-dialect'
import { dbClientGeneration, makeForwardingClient, releaseDbClient } from './db-bun'
import type { PortableDb } from './portable-db'

/**
 * Who owns the database client, and when it closes.
 *
 * The `Database` layer a server's runtime provides takes a LEASE on the one
 * memoised client when it is acquired and gives it back when the runtime is
 * disposed. When the last lease of the current generation is given back, the
 * client is closed and every memo built beside it is cleared: the pool lives as
 * long as the server that uses it, not as long as the process.
 *
 * Taking a lease opens no connection. The client is still built on its first
 * read, for two reasons that both predate the layer: a PostgreSQL pool must be
 * built AFTER the boot has probed whether the database accepts the runtime
 * settings (`postgres-client-options.ts`), and a runtime that never queries —
 * a static render of an app with no tables — must not create a SQLite file.
 * When the boot's earlier steps (migrations, the admin bootstrap) have already
 * built the client, the lease adopts it; there is never a second pool.
 */

/** One acquisition of the client by a `Database` layer. */
export interface DatabaseLease {
  /** The client generation the lease was taken in (see `resetDbCache`). */
  readonly generation: number
  /** The engine resolved when the lease was taken. */
  readonly kind: DatabaseDialect
  /** The client the lease hands out; it refuses to serve once the lease is released. */
  readonly client: PortableDb
}

/**
 * A read through the client of a `Database` layer that has been released —
 * a fiber still running after its server stopped.
 *
 * Thrown instead of serving the read because serving it would reopen a pool
 * that nothing would ever close again.
 */
export class DatabaseReleasedError extends Data.TaggedError('DatabaseReleasedError')<{
  readonly message: string
}> {}

/** The live leases, counted per generation. */
const live = new Map<'generation' | 'count', number>([
  ['generation', 0],
  ['count', 0],
])

/** Leases already given back, so a double release is a no-op. */
const released = new WeakSet<object>()

/** Each lease's release marker, kept off the public shape. */
const leaseMarkers = new WeakMap<DatabaseLease, object>()

/** How many leases of the current generation are live. */
export const liveDatabaseLeases = (): number =>
  live.get('generation') === dbClientGeneration() ? (live.get('count') ?? 0) : 0

/**
 * Take a lease on the client and publish the engine it speaks.
 *
 * The engine is resolved here, once, from the decoded environment; every
 * per-call "am I SQLite?" reader answers from it until the last lease is
 * given back.
 */
export const openDatabaseLease = (): DatabaseLease => {
  const generation = dbClientGeneration()
  live.set('count', liveDatabaseLeases() + 1)
  live.set('generation', generation)
  const kind = parseDatabaseDialectConfig(process.env).dialect
  setActiveDialectKind(kind)
  const marker = { generation }
  const lease: DatabaseLease = {
    generation,
    kind,
    client: makeForwardingClient(() => {
      if (released.has(marker)) {
        throw new DatabaseReleasedError({
          message:
            'The database client was read after the server that owned it stopped. ' +
            'Work that outlives its server must not reach the database.',
        })
      }
    }),
  }
  leaseMarkers.set(lease, marker)
  return lease
}

/**
 * Give a lease back. The last live lease of its generation closes the client
 * and waits for the close; a lease whose generation a reset already retired
 * closes nothing, because the client in use now belongs to whoever booted
 * after it. Never rejects.
 */
export const closeDatabaseLease = async (lease: DatabaseLease): Promise<void> => {
  const marker = leaseMarkers.get(lease)
  if (marker === undefined || released.has(marker)) return
  released.add(marker)
  if (lease.generation !== dbClientGeneration()) return
  const remaining = liveDatabaseLeases() - 1
  live.set('count', Math.max(remaining, 0))
  if (remaining > 0) return
  setActiveDialectKind(undefined)
  await releaseDbClient()
}
