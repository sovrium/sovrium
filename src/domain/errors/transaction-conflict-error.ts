/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { collectCauseChain, readSqlState } from './driver-failure'

/**
 * A transaction the database aborted because it lost a conflict with another
 * one running at the same time: `40P01` deadlock_detected or `40001`
 * serialization_failure, PostgreSQL's names for two transactions meeting.
 *
 * Nothing in either statement was wrong, and the losing one may succeed when
 * sent again. So it is neither the caller's fault nor an operator fault: the
 * erasure runs again on it, and a record write is answered 409 Conflict.
 *
 * The SQLSTATE is read off the `cause` chain by the driver classifier's own
 * reader (`driver-failure.ts`), which knows where each driver puts it.
 */
const TRANSACTION_CONFLICT_SQLSTATES: ReadonlySet<string> = new Set(['40P01', '40001'])

/**
 * The SQLSTATE with which the database aborted `error`'s transaction on a
 * conflict with a concurrent one, or `undefined` when it did not.
 */
export function transactionConflictOf(error: unknown): string | undefined {
  return collectCauseChain(error)
    .map((node) => readSqlState(node))
    .find(
      (state): state is string => state !== undefined && TRANSACTION_CONFLICT_SQLSTATES.has(state)
    )
}
