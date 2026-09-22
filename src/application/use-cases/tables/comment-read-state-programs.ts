/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { NotFoundError } from '@/domain/errors'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'

/**
 * Mark a record's comments read for the current user.
 *
 * Verifies the caller can access the record — a caller who cannot read the
 * record must not be able to write read-state for it, so a missing/inaccessible
 * record fails with a not-found error the route maps to 404 (S1
 * anti-enumeration). On success, upserts the per-user read-state watermark to
 * NOW(). `readTracking` gating happens at the route layer (the read-state table
 * only exists when a table opts in), so this program is only reached for
 * tracking-enabled tables.
 */
export function markRecordCommentsReadProgram(config: {
  readonly session: Readonly<UserSession>
  readonly tableId: string
  readonly recordId: string
  readonly tableName: string
}): Effect.Effect<void, DatabaseError | NotFoundError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, tableId, recordId, tableName } = config

    const hasAccess = yield* comments.checkRecordExists({ session, tableName, recordId })
    if (!hasAccess) {
      return yield* Effect.fail(new NotFoundError('Record not found'))
    }

    yield* comments.markRead({ session, tableId, recordId })
  }).pipe(Effect.withSpan('tables.mark-record-comments-read-program'))
}
