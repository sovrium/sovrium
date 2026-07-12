/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { SessionContextError } from '@/domain/errors'
import type { UserSession } from '@/application/ports/models/user-session'

export function markRecordCommentsReadProgram(config: {
  readonly session: Readonly<UserSession>
  readonly tableId: string
  readonly recordId: string
  readonly tableName: string
}): Effect.Effect<void, SessionContextError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, tableId, recordId, tableName } = config

    const hasAccess = yield* comments.checkRecordExists({ session, tableName, recordId })
    if (!hasAccess) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    yield* comments.markRead({ session, tableId, recordId })
  })
}
