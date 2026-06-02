/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  deleteCommentProgram,
  getCommentProgram,
  listCommentsProgram,
  updateCommentProgram,
  updateCommentStatusProgram,
} from '@/application/use-cases/tables/comment-programs'
import { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { notFoundResponse } from './comment-handler-shared'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './utils'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export { handleCreateComment } from './comment-create-handler'

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

  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
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

  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
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

type ValidatedUpdateBody =
  | { readonly kind: 'content'; readonly content: string }
  | { readonly kind: 'status'; readonly status: 'approved' | 'rejected' | 'pending' }

function isModerationStatus(status: string): status is 'approved' | 'rejected' | 'pending' {
  return status === 'approved' || status === 'rejected' || status === 'pending'
}

function isValidEditContent(content: unknown): content is string {
  return typeof content === 'string' && content.length > 0 && content.length <= 10_000
}

function validateUpdateCommentBody(body: unknown): ValidatedUpdateBody | undefined {
  if (typeof body !== 'object' || body === null || body === undefined) {
    return undefined
  }

  const { content, status } = body as Record<string, unknown>

  if (typeof status === 'string') {
    return isModerationStatus(status) ? { kind: 'status', status } : undefined
  }

  return isValidEditContent(content) ? { kind: 'content', content } : undefined
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

async function handleModerationStatusUpdate(input: {
  readonly c: Context
  readonly table: NonNullable<App['tables']>[number]
  readonly commentId: string
  readonly status: 'approved' | 'rejected' | 'pending'
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
}): Promise<Response> {
  const { c, table, commentId, status, userRole } = input

  if (userRole !== 'admin') {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  const result = await runTableProgram(
    updateCommentStatusProgram({
      session: input.session,
      commentId,
      tableName: table.name,
      status,
    })
  )

  if (result._tag === 'Left') {
    return handleUpdateCommentError(c, result.left)
  }

  if (result.right !== undefined) {
    return c.json(result.right, 200)
  }
  return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

export async function handleUpdateComment(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const commentId = c.req.param('commentId')!

  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
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

  if (validated.kind === 'status') {
    return handleModerationStatusUpdate({
      c,
      table,
      commentId,
      status: validated.status,
      userRole,
      session,
    })
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

function resolveTableForListing(
  c: Context,
  app: App,
  tableId: string,
  userRole: string
): NonNullable<App['tables']>[number] | Response {
  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
  if (!table || !hasReadPermission(table, userRole, app.tables)) {
    return notFoundResponse(c)
  }
  return table
}

export async function handleListComments(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  const tableOrResponse = resolveTableForListing(c, app, tableId, userRole)
  if (tableOrResponse instanceof Response) return tableOrResponse
  const table = tableOrResponse

  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam ? Number(limitParam) : undefined
  const offset = offsetParam ? Number(offsetParam) : undefined
  const sortOrder = parseSortOrder(c.req.query('sort'))

  const viewerIsAdmin = userRole === 'admin'

  const result = await runTableProgram(
    listCommentsProgram({
      session,
      recordId,
      tableName: table.name,
      limit,
      offset,
      sortOrder,
      viewerIsAdmin,
    })
  )

  if (result._tag === 'Left') {
    return notFoundResponse(c)
  }

  return c.json(result.right, 200)
}
