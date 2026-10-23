/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { readPositionsProgram } from '@/application/use-cases/tables/read-state-programs'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { logError } from '@/infrastructure/logging/logger'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import type { ReadReadPosition } from '@/application/ports/repositories/tables/read-state-repository'
import type { Context } from 'hono'

/**
 * The page reader's position on one parent record of a `readState`
 * relationship, read from the same store the mark-read route moves, on this
 * request's services — so a conversation places its New marker where her
 * unread count starts. A visitor without an account, or a record she never
 * read, has no position.
 */
export const readPositionReader =
  (c: Context): ReadReadPosition =>
  async (tableName, recordId, session) => {
    if (session === undefined || isGuestSession(session.userId)) return undefined
    const answer = await runOnRequest(
      c,
      readPositionsProgram({ userId: session.userId, tableName, recordIds: [recordId] }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[pages] a read position could not be read', cause))
        )
      )
    )
    // effect-swallow: see the tap above. Without her position the conversation
    // draws no New marker; it never draws one in a place her rows do not justify.
    return answer._tag === 'Success' ? answer.success.get(recordId) : undefined
  }
