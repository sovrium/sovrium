/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useRef } from 'react'

/**
 * Serialises writes per record, so two saves to the same row never overlap.
 *
 * A grid fires one save per cell, and tabbing quickly through a row starts the
 * next before the previous has answered. Left concurrent, both writes are made
 * against the same version of the record: the first bumps `updated_at`, and the
 * second — carrying a token that was already current when it was read — is
 * refused as a stale write. The row conflicts with itself, and the user's edit
 * is dropped with a message blaming a concurrent editor who does not exist.
 *
 * Queueing removes the race at its source rather than papering over it: each
 * save resolves its token after its predecessor has landed, so the version it
 * declares is the version it is actually writing over. Writes to DIFFERENT rows
 * stay parallel — they cannot conflict with one another.
 *
 * The queue is keyed by row and holds one promise per row that has ever been
 * written on this grid. That set is bounded by the rows on screen.
 */
export function useRowSaveQueue() {
  const queueRef = useRef<Readonly<Record<string, Promise<unknown>>>>({})

  return useCallback(<T>(rowId: string | number, run: () => Promise<T>): Promise<T> => {
    const key = String(rowId)
    const previous = queueRef.current[key] ?? Promise.resolve()
    // `run` on both settlements: a save that failed must not block the row
    // forever, and the retry that follows it is exactly the next in line.
    const next = previous.then(run, run)
    // eslint-disable-next-line functional/immutable-data -- Ref holds the per-row write chain
    queueRef.current = { ...queueRef.current, [key]: next.catch(() => undefined) }
    return next
  }, [])
}
