/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { triggerCommentEventAutomations } from '@/application/use-cases/automations/trigger-comment-event'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { CommentRepositoryLive } from '@/infrastructure/database/repositories/comment-repository-live'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { App } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/utils/context-helpers'

/**
 * Fire the comment-posted (Y-6) trigger after a successful comment-create.
 *
 * Errors are absorbed at the boundary — a failed automation must NOT
 * roll back the comment-create or surface as a 5xx on the API response.
 * Mirrors the pattern used by `triggerRecordEventAutomations` in
 * record-write-handlers (the same swallow-on-failure contract is
 * documented there).
 */
export async function dispatchCommentPostedTrigger(input: {
  readonly app: App
  readonly tableName: string
  readonly tableId: string
  readonly recordId: string
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly comment: {
    readonly id: string
    readonly content: string
    readonly parentCommentId: string | null
    readonly createdAt: string
    /**
     * Status surfaced from the `createCommentProgram` result envelope. PG-02
     * locked auto-mode to insert rows as `'approved'` so the trigger gate
     * (matchesCommentTrigger) lets `when: 'approved'` automations fire
     * immediately. Defaults to `'approved'` when the program does not yet
     * project the column (today's path) — matching the DB column default.
     */
    readonly status: 'pending' | 'approved' | 'rejected'
  }
  readonly user: { readonly id: string; readonly email: string; readonly name: string } | undefined
  readonly mentions: readonly string[]
}): Promise<void> {
  if (!input.user) return
  const program = triggerCommentEventAutomations({
    app: input.app,
    tableName: input.tableName,
    tableId: input.tableId,
    recordId: input.recordId,
    session: input.session,
    userRole: input.userRole,
    comment: {
      id: input.comment.id,
      body: input.comment.content,
      parentCommentId: input.comment.parentCommentId,
      createdAt: new Date(input.comment.createdAt),
      status: input.comment.status,
    },
    author: input.user,
    mentions: input.mentions,
    processEnv: process.env,
  })
  // eslint-disable-next-line functional/no-expression-statements -- IO boundary: trigger dispatch returns void
  await Effect.runPromise(
    provideAutomationRuntime(program.pipe(Effect.provide(CommentRepositoryLive)))
  )
}

/**
 * Build the trigger-dispatch arguments from the create-comment program
 * result. Extracted so `handleCreateComment` stays under the 50-line
 * function-length limit imposed by `[internal ref]`.
 */
export function buildTriggerDispatchArgs(input: {
  readonly app: App
  readonly tableName: string
  readonly tableId: string
  readonly recordId: string
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly comment: {
    readonly id: string
    readonly content: string
    readonly parentCommentId: string | null
    readonly createdAt: string
  }
  /**
   * Full comment author (INCLUDING email) sourced from the create-program's
   * `author` field, NOT from the response `comment.user` (which is the
   * no-email display projection). The comment-posted trigger populates
   * `{{trigger.author.email}}` from here — this is the one legit server-side
   * email consumer (B1).
   */
  readonly author: UserMetadataWithOptionalImage | undefined
  readonly mentions: readonly string[]
}): Parameters<typeof dispatchCommentPostedTrigger>[0] {
  const { comment, author } = input
  return {
    app: input.app,
    tableName: input.tableName,
    tableId: input.tableId,
    recordId: input.recordId,
    userRole: input.userRole,
    session: input.session,
    comment: {
      id: comment.id,
      content: comment.content,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt,
      // PG-02 lock: today the create-program does not surface a moderation
      // status — comments insert as the DB column default (`'approved'`), so
      // the trigger's `when: 'approved'` gate passes. When the moderation
      // pipeline lands and starts returning `'pending'` rows, the program
      // will surface the actual column value through this path.
      status: 'approved',
    },
    user: author ? { id: author.id, email: author.email, name: author.name } : undefined,
    mentions: input.mentions,
  }
}
