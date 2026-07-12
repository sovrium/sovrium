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
  await Effect.runPromise(
    provideAutomationRuntime(program.pipe(Effect.provide(CommentRepositoryLive)))
  )
}

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
      status: 'approved',
    },
    user: author ? { id: author.id, email: author.email, name: author.name } : undefined,
    mentions: input.mentions,
  }
}
