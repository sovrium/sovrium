/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/** Database error for read-state operations. */
export class ReadStateDatabaseError extends Data.TaggedError('ReadStateDatabaseError')<{
  readonly cause: unknown
}> {}

/** How far one person has read one parent record. */
export interface ReadPosition {
  readonly tableName: string
  readonly recordId: string
  readonly lastReadAt: Date
}

/**
 * `system.read_state` port — per person and per parent record of a
 * `readState` relationship, the moment she last read it.
 */
export class ReadStateRepository extends Context.Service<
  ReadStateRepository,
  {
    /** Move her position on the parent record to `at`. */
    readonly markRead: (input: {
      readonly userId: string
      readonly tableName: string
      readonly recordId: string
      readonly at: Date
    }) => Effect.Effect<void, ReadStateDatabaseError>

    /** Her positions on the given parent records of a table; a record she never read is absent. */
    readonly positionsOf: (input: {
      readonly userId: string
      readonly tableName: string
      readonly recordIds: readonly string[]
    }) => Effect.Effect<readonly ReadPosition[], ReadStateDatabaseError>

    /** Every position she holds, for her account export. */
    readonly listForUser: (
      userId: string
    ) => Effect.Effect<readonly ReadPosition[], ReadStateDatabaseError>
  }
>()('ReadStateRepository') {}

/**
 * How far the caller holding `session` has read one parent record, as a page
 * render reads it: the instant of her last read, `undefined` when she never
 * read it (or has no account).
 */
export type ReadReadPosition = (
  tableName: string,
  recordId: string,
  session: SessionInfo | undefined
) => Promise<Date | undefined>
