/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of one grant re-check sweep over a registry's live connections
 * (`./connection-counter`): in batches, each batch's sessions settled in ONE
 * read, every judgement sharing one memo.
 */

import { logError } from '@/infrastructure/logging/logger'
import type { LiveSessionReader, RecheckSweep } from './connection-counter'

/**
 * What the sweep knows of a session it asked about: alive, dead, or unknown
 * (the read failed).
 */
export type SessionState = 'alive' | 'dead' | 'unknown'

/** A connection as the sweep sees it: the session it opened with. */
interface SweptConnection {
  readonly sessionId: string
}

/**
 * How many connections a sweep re-checks at once. Each re-check may read the
 * database, so a server holding thousands of sockets spreads a sweep over
 * batches rather than issuing every read in the same tick.
 */
const RECHECK_BATCH_SIZE = 16

/** `items` cut into consecutive batches of at most `size`. */
const batchesOf = <A>(items: readonly A[], size: number): readonly (readonly A[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  )

const newSweep = (): RecheckSweep => {
  const results = new Map<string, Promise<unknown>>()
  return {
    memo: <A>(key: string, compute: () => Promise<A>): Promise<A> => {
      const known = results.get(key)
      if (known !== undefined) return known as Promise<A>
      const computed = compute()
      results.set(key, computed)
      return computed
    },
  }
}

/**
 * Settle, in ONE read, the state of every session of `batch` the sweep has not
 * asked about yet — so a session shared by connections in several batches is
 * read once per sweep.
 */
const settleSessionStates = async (
  batch: readonly SweptConnection[],
  known: Map<string, SessionState>,
  readLiveSessions: LiveSessionReader
): Promise<void> => {
  const unasked = [...new Set(batch.map((entry) => entry.sessionId))].filter(
    (sessionId) => !known.has(sessionId)
  )
  if (unasked.length === 0) return
  const live = await readLiveSessions(unasked).catch((error: unknown) => {
    logError('[realtime] reading session liveness failed; closing the connections', error, {
      sessions: String(unasked.length),
    })
    return undefined
  })
  unasked.forEach((sessionId) => {
    known.set(sessionId, live === undefined ? 'unknown' : live.has(sessionId) ? 'alive' : 'dead')
  })
}

/**
 * Judge every one of `connections`, batch by batch, once its session's state
 * is settled. Answers how many the judgement closed.
 */
export const runRecheckSweep = <C extends SweptConnection>(
  connections: readonly C[],
  readLiveSessions: LiveSessionReader,
  judge: (connection: C, session: SessionState, sweep: RecheckSweep) => Promise<boolean>
): Promise<number> => {
  const sweep = newSweep()
  const sessions = new Map<string, SessionState>()
  return batchesOf(connections, RECHECK_BATCH_SIZE).reduce<Promise<number>>(
    async (closedSoFar, batch) => {
      const before = await closedSoFar
      await settleSessionStates(batch, sessions, readLiveSessions)
      const closed = await Promise.all(
        batch.map((entry) => judge(entry, sessions.get(entry.sessionId) ?? 'unknown', sweep))
      )
      return before + closed.filter(Boolean).length
    },
    Promise.resolve(0)
  )
}
