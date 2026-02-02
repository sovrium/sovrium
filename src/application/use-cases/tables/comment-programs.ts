/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database/session-context'
import {
  createComment,
  getCommentWithUser,
  checkRecordOwnership,
} from '@/infrastructure/database/table-queries/comment-queries'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Create comment on a record
 */
interface CreateCommentConfig {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
  readonly tableName: string
  readonly content: string
}

/**
 * Format comment with user data
 */
function formatCommentResponse(comment: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly user?:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | undefined
      }
    | undefined
}) {
  return {
    comment: {
      id: comment.id,
      tableId: comment.tableId,
      recordId: comment.recordId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
    },
  }
}

export function createCommentProgram(config: CreateCommentConfig): Effect.Effect<
  {
    readonly comment: {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string
      readonly content: string
      readonly createdAt: string
      readonly user?:
        | {
            readonly id: string
            readonly name: string
            readonly email: string
            readonly image: string | undefined
          }
        | undefined
    }
  },
  SessionContextError
> {
  return Effect.gen(function* () {
    const { session, tableId, recordId, tableName, content } = config

    // Check if record exists and is owned by user
    const hasAccess = yield* checkRecordOwnership({ session, tableName, recordId })
    if (!hasAccess) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    // Create comment
    const comment = yield* createComment({ session, tableId, recordId, content })

    // Fetch comment with user metadata
    const commentWithUser = yield* getCommentWithUser({ session, commentId: comment.id })

    // Format response
    return formatCommentResponse(commentWithUser ?? comment)
  })
}
