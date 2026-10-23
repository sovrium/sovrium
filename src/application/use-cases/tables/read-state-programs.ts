/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ReadStateRepository,
  type ReadPosition,
  type ReadStateDatabaseError,
} from '@/application/ports/repositories/tables/read-state-repository'

/**
 * Move the reader's position on one parent record to now: every child created
 * before this moment is read, every child created after it is unread.
 */
export const markParentReadProgram = (input: {
  readonly userId: string
  readonly tableName: string
  readonly recordId: string
}): Effect.Effect<void, ReadStateDatabaseError, ReadStateRepository> =>
  Effect.gen(function* () {
    const repo = yield* ReadStateRepository
    yield* repo.markRead({ ...input, at: new Date() })
  }).pipe(Effect.withSpan('tables.mark-parent-read'))

/**
 * The reader's positions on the given parent records, by record id. A record
 * she never read is absent: all its children are unread to her.
 */
export const readPositionsProgram = (input: {
  readonly userId: string
  readonly tableName: string
  readonly recordIds: readonly string[]
}): Effect.Effect<ReadonlyMap<string, Date>, ReadStateDatabaseError, ReadStateRepository> =>
  Effect.gen(function* () {
    const repo = yield* ReadStateRepository
    const positions = yield* repo.positionsOf(input)
    return new Map(positions.map((position) => [position.recordId, position.lastReadAt]))
  }).pipe(Effect.withSpan('tables.read-positions'))

/** Every read position of one person, for her account export. */
export const listReadPositionsProgram = (
  userId: string
): Effect.Effect<readonly ReadPosition[], ReadStateDatabaseError, ReadStateRepository> =>
  Effect.gen(function* () {
    const repo = yield* ReadStateRepository
    return yield* repo.listForUser(userId)
  }).pipe(Effect.withSpan('tables.list-read-positions'))
