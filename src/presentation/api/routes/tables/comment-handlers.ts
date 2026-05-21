/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { triggerCommentEventAutomations } from '@/application/use-cases/automations/trigger-comment-event'
import {
  createCommentProgram,
  deleteCommentProgram,
  getCommentProgram,
  listCommentsProgram,
  updateCommentProgram,
} from '@/application/use-cases/tables/comment-programs'
import { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { CommentRepositoryLive } from '@/infrastructure/database/repositories/comment-repository-live'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './utils'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

interface CreateCommentBody {
  readonly content: string
  readonly parentCommentId?: string
  readonly mentions: readonly string[]
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

  const { parentCommentId, mentions } = payload
  const validatedParent = typeof parentCommentId === 'string' ? parentCommentId : undefined
  const validatedMentions = Array.isArray(mentions)
    ? mentions.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

  return { content: text, parentCommentId: validatedParent, mentions: validatedMentions }
}

function handleCommentError(c: Context, error: unknown) {
  if (isAuthorizationError(error)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return handleRouteError(c, error)
}

async function dispatchCommentPostedTrigger(input: {
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
    },
    author: input.user,
    mentions: input.mentions,
    processEnv: process.env,
  })
  await Effect.runPromise(
    provideAutomationRuntime(program.pipe(Effect.provide(CommentRepositoryLive)))
  )
}

function buildTriggerDispatchArgs(input: {
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
    readonly user?: UserMetadataWithOptionalImage | undefined
  }
  readonly mentions: readonly string[]
}): Parameters<typeof dispatchCommentPostedTrigger>[0] {
  const { comment } = input
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
    },
    user: comment.user
      ? { id: comment.user.id, email: comment.user.email, name: comment.user.name }
      : undefined,
    mentions: input.mentions,
  }
}

async function checkCreateCommentGate(
  c: Context,
  app: App
): Promise<
  | {
      readonly ok: true
      readonly table: NonNullable<App['tables']>[number]
      readonly validated: CreateCommentBody
    }
  | { readonly ok: false; readonly response: Response }
> {
  const { tableName, userRole } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) {
    return {
      ok: false,
      response: c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404),
    }
  }
  if (!hasReadPermission(table, userRole, app.tables)) {
    return {
      ok: false,
      response: c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      ),
    }
  }
  const body = await c.req.json().catch(() => undefined)
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
  return { ok: true, table, validated }
}

export async function handleCreateComment(c: Context, app: App) {
  const gate = await checkCreateCommentGate(c, app)
  if (!gate.ok) return gate.response
  const { session, tableId, userRole } = getTableContext(c)
  const recordId = c.req.param('recordId')!
  const { table, validated } = gate

  const result = await runTableProgram(
    createCommentProgram({
      session,
      tableId,
      recordId,
      tableName: table.name,
      content: validated.content,
      parentCommentId: validated.parentCommentId,
    })
  )

  if (result._tag === 'Left') {
    return handleCommentError(c, result.left)
  }

  await dispatchCommentPostedTrigger(
    buildTriggerDispatchArgs({
      app,
      tableName: table.name,
      tableId,
      recordId,
      userRole,
      session,
      comment: result.right.comment,
      mentions: validated.mentions,
    })
  )

  return c.json(result.right, 201)
}

function handleDeleteCommentError(c: Context, error: unknown) {
  if (isAuthorizationError(error)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return handleRouteError(c, error)
}

export async function handleDeleteComment(c: Context, app: App) {
  const { session } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const commentId = c.req.param('commentId')!

  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  const program = deleteCommentProgram({
    session,
    commentId,
    tableName: table.name,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return handleDeleteCommentError(c, result.left)
  }

  return c.body(null, 204)
}

export async function handleGetComment(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const commentId = c.req.param('commentId')!

  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  if (!hasReadPermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const program = getCommentProgram({
    session,
    commentId,
    tableName: table.name,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.right, 200)
}

function validateUpdateCommentBody(body: unknown): { readonly content: string } | undefined {
  if (typeof body !== 'object' || body === undefined) {
    return undefined
  }

  const { content } = body as Record<string, unknown>

  if (typeof content !== 'string') {
    return undefined
  }

  if (content.length === 0) {
    return undefined
  }

  if (content.length > 10_000) {
    return undefined
  }

  return { content }
}

function handleUpdateCommentError(c: Context, error: unknown) {
  if (isAuthorizationError(error)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(
    { success: false, message: 'Failed to update comment', code: 'INTERNAL_ERROR' },
    500
  )
}

export async function handleUpdateComment(c: Context, app: App) {
  const { session } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const commentId = c.req.param('commentId')!

  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json().catch(() => undefined)
  const validated = validateUpdateCommentBody(body)

  if (!validated) {
    return c.json(
      { success: false, message: 'Invalid request body', code: 'VALIDATION_ERROR' },
      400
    )
  }

  const program = updateCommentProgram({
    session,
    commentId,
    tableName: table.name,
    content: validated.content,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return handleUpdateCommentError(c, result.left)
  }

  return c.json(result.right, 200)
}

function parseSortOrder(sortParam: string | undefined): 'asc' | 'desc' | undefined {
  if (!sortParam) {
    return undefined
  }

  const [field, order] = sortParam.split(':')
  if (field === 'createdAt' && (order === 'asc' || order === 'desc')) {
    return order
  }

  return undefined
}

export async function handleListComments(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  if (!hasReadPermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const sortParam = c.req.query('sort')

  const limit = limitParam ? Number(limitParam) : undefined
  const offset = offsetParam ? Number(offsetParam) : undefined
  const sortOrder = parseSortOrder(sortParam)

  const program = listCommentsProgram({
    session,
    recordId,
    tableName: table.name,
    limit,
    offset,
    sortOrder,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.right, 200)
}
