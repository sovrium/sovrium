/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { createCommentProgram } from '@/application/use-cases/tables/comment-programs'
import { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import {
  resolveCommentModerationStatus,
  requiresAuthenticationForComment,
  type CommentModerationConfig,
} from '@/domain/services/comment-moderation-policy'
import { isAuthenticatedSession } from '@/domain/services/guest-session'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { notFoundResponse } from './comment-handler-shared'
import { applyRateLimit, classifySpam } from './comment-spam-guards'
import { buildTriggerDispatchArgs, dispatchCommentPostedTrigger } from './comment-trigger-dispatch'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './utils'
import type { App } from '@/domain/models/app'
import type { CommentSpamStatus } from '@/domain/services/comment-spam-classification'
import type { Context } from 'hono'

interface CreateCommentBody {
  readonly content: string
  readonly parentCommentId?: string
  readonly mentions: readonly string[]
  readonly guestName?: string
  readonly guestEmail?: string
}

function validateCommentText(payload: Record<string, unknown>): string | undefined {
  const { content, body } = payload
  const candidate = typeof body === 'string' ? body : typeof content === 'string' ? content : ''
  if (candidate.length === 0 || candidate.length > 10_000) return undefined
  return candidate
}

function validateCreateCommentBody(body: unknown): CreateCommentBody | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const payload = body as Record<string, unknown>

  const text = validateCommentText(payload)
  if (text === undefined) return undefined

  const { parentCommentId, mentions, guestName, guestEmail } = payload
  const validatedParent = typeof parentCommentId === 'string' ? parentCommentId : undefined
  const validatedMentions = Array.isArray(mentions)
    ? mentions.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const validatedGuestName =
    typeof guestName === 'string' && guestName.length > 0 ? guestName : undefined
  const validatedGuestEmail =
    typeof guestEmail === 'string' && guestEmail.length > 0 ? guestEmail : undefined

  return {
    content: text,
    parentCommentId: validatedParent,
    mentions: validatedMentions,
    guestName: validatedGuestName,
    guestEmail: validatedGuestEmail,
  }
}

function handleCommentError(c: Context, error: unknown) {
  if (isAuthorizationError(error)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return handleRouteError(c, error)
}

function isHoneypotEnabled(table: NonNullable<App['tables']>[number]): boolean {
  const cfg = (table.comments ?? {}) as {
    guestComments?: boolean
    spamProtection?: { honeypot?: boolean }
  }
  if (!cfg.guestComments) return false
  return cfg.spamProtection?.honeypot !== false
}

function readHoneypotValue(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const value = (body as Record<string, unknown>).honeypot
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

type CombinedModerationStatus = 'approved' | 'pending' | 'rejected'

type CreateCommentGate =
  | {
      readonly ok: true
      readonly table: NonNullable<App['tables']>[number]
      readonly validated: CreateCommentBody
      readonly spamStatus: CommentSpamStatus
      readonly combinedStatus: CombinedModerationStatus
    }
  | { readonly ok: false; readonly response: Response }

function combineModerationVerdicts(
  spamStatus: CommentSpamStatus,
  moderationStatus: 'approved' | 'pending'
): CombinedModerationStatus {
  if (spamStatus === 'rejected') return 'rejected'
  if (spamStatus === 'pending') return 'pending'
  return moderationStatus
}

function readModerationConfig(table: NonNullable<App['tables']>[number]): CommentModerationConfig {
  return (table.comments ?? {}) as CommentModerationConfig
}

async function checkCreateCommentGate(c: Context, app: App): Promise<CreateCommentGate> {
  const { tableName, userRole, session } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return { ok: false, response: notFoundResponse(c) }
  if (!hasReadPermission(table, userRole, app.tables)) {
    return { ok: false, response: notFoundResponse(c) }
  }

  const moderationConfig = readModerationConfig(table)
  const isAuthenticated = isAuthenticatedSession(session.userId)
  if (requiresAuthenticationForComment(moderationConfig) && !isAuthenticated) {
    return {
      ok: false,
      response: c.json(
        {
          success: false,
          message: 'Authentication required to post comments',
          code: 'AUTH_REQUIRED',
        },
        401
      ),
    }
  }

  const body = await c.req.json().catch(() => undefined)

  if (isHoneypotEnabled(table) && readHoneypotValue(body) !== undefined) {
    return { ok: false, response: c.json({ success: true, discarded: true }, 200) }
  }

  const rateLimitResponse = applyRateLimit({ c, table })
  if (rateLimitResponse !== undefined) return { ok: false, response: rateLimitResponse }

  const validated = validateCreateCommentBody(body)
  if (!validated) {
    return {
      ok: false,
      response: c.json(
        { success: false, message: 'Invalid request body', code: 'VALIDATION_ERROR' },
        400
      ),
    }
  }

  const { spamStatus, combinedStatus } = classifyComment({
    table,
    content: validated.content,
    moderationConfig,
    isAuthenticated,
  })

  return { ok: true, table, validated, spamStatus, combinedStatus }
}

function classifyComment(input: {
  readonly table: NonNullable<App['tables']>[number]
  readonly content: string
  readonly moderationConfig: CommentModerationConfig
  readonly isAuthenticated: boolean
}): { readonly spamStatus: CommentSpamStatus; readonly combinedStatus: CombinedModerationStatus } {
  const spamStatus = classifySpam(input.table, input.content)

  const moderationStatus = resolveCommentModerationStatus(input.moderationConfig, {
    isAuthenticated: input.isAuthenticated,
    priorApprovedCommentExists: false,
  })
  return { spamStatus, combinedStatus: combineModerationVerdicts(spamStatus, moderationStatus) }
}

function synthesizeClassifiedComment(input: {
  readonly status: CombinedModerationStatus
  readonly recordId: string
  readonly tableId: string
  readonly content: string
  readonly parentCommentId: string | undefined
}): { readonly status: CombinedModerationStatus; readonly comment: Record<string, unknown> } {
  const now = new Date().toISOString()
  return {
    status: input.status,
    comment: {
      id: crypto.randomUUID(),
      tableId: input.tableId,
      recordId: input.recordId,
      userId: null,
      content: input.content,
      parentCommentId: input.parentCommentId ?? null,
      createdAt: now,
      updatedAt: now,
      status: input.status,
    },
  }
}

async function checkSingleLevelThreading(
  c: Context,
  parentCommentId: string | undefined
): Promise<Response | undefined> {
  if (parentCommentId === undefined) return undefined
  const { session } = getTableContext(c)
  const lookup = await runTableProgram(
    Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.getWithUser({ session, commentId: parentCommentId })
    })
  )
  if (lookup._tag === 'Left' || lookup.right === undefined) return undefined
  if (lookup.right.parentId !== null) {
    return c.json(
      {
        success: false,
        message:
          'Cannot reply to a reply — parentCommentId must reference a top-level comment (single-level threading)',
        code: 'NESTED_REPLY_REJECTED',
      },
      422
    )
  }
  return undefined
}

export async function handleCreateComment(c: Context, app: App) {
  const gate = await checkCreateCommentGate(c, app)
  if (!gate.ok) return gate.response
  const { session, tableId, userRole } = getTableContext(c)
  const recordId = c.req.param('recordId')!
  const { table, validated, combinedStatus } = gate

  const depthResponse = await checkSingleLevelThreading(c, validated.parentCommentId)
  if (depthResponse !== undefined) return depthResponse

  return persistResolvedComment({
    c,
    app,
    table,
    validated,
    session,
    tableId,
    recordId,
    userRole,
    status: combinedStatus,
  })
}

function handleCreateProgramLeft(c: Context, error: unknown): Response {
  return handleCommentError(c, error)
}

function handleResolvedCommentLeft(input: {
  readonly c: Context
  readonly error: unknown
  readonly status: CombinedModerationStatus
  readonly recordId: string
  readonly tableId: string
  readonly content: string
  readonly parentCommentId: string | undefined
}): Response {
  const { c, error, status, recordId, tableId, content, parentCommentId } = input
  if (status !== 'approved' && isAuthorizationError(error)) {
    return c.json(
      synthesizeClassifiedComment({ status, recordId, tableId, content, parentCommentId }),
      201
    )
  }
  return handleCreateProgramLeft(c, error)
}

async function maybeFireCommentPostedTrigger(input: {
  readonly app: App
  readonly table: NonNullable<App['tables']>[number]
  readonly validated: CreateCommentBody
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableId: string
  readonly recordId: string
  readonly userRole: string
  readonly status: CombinedModerationStatus
  readonly result: Effect.Effect.Success<ReturnType<typeof createCommentProgram>>
}): Promise<void> {
  const { app, table, validated, session, tableId, recordId, userRole, status, result } = input
  if (status !== 'approved') return
  await dispatchCommentPostedTrigger(
    buildTriggerDispatchArgs({
      app,
      tableName: table.name,
      tableId,
      recordId,
      userRole,
      session,
      comment: result.comment,
      author: result.author,
      mentions: validated.mentions,
    })
  )
}

async function persistResolvedComment(input: {
  readonly c: Context
  readonly app: App
  readonly table: NonNullable<App['tables']>[number]
  readonly validated: CreateCommentBody
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableId: string
  readonly recordId: string
  readonly userRole: string
  readonly status: CombinedModerationStatus
}): Promise<Response> {
  const { c, app, table, validated, session, tableId, recordId, userRole, status } = input

  const result = await runTableProgram(
    createCommentProgram({
      session,
      tableId,
      recordId,
      tableName: table.name,
      content: validated.content,
      parentCommentId: validated.parentCommentId,
      guestName: validated.guestName,
      guestEmail: validated.guestEmail,
      status,
    })
  )

  if (result._tag === 'Left') {
    return handleResolvedCommentLeft({
      c,
      error: result.left,
      status,
      recordId,
      tableId,
      content: validated.content,
      parentCommentId: validated.parentCommentId,
    })
  }

  await maybeFireCommentPostedTrigger({
    app,
    table,
    validated,
    session,
    tableId,
    recordId,
    userRole,
    status,
    result: result.right,
  })

  return c.json({ comment: result.right.comment, status: result.right.comment.status }, 201)
}
