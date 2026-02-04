/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  createCommentProgram,
  deleteCommentProgram,
  getCommentProgram,
  listCommentsProgram,
} from '@/application/use-cases/tables/comment-programs'
import { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { isAuthorizationError } from './utils'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Create comment request validation
 */
interface CreateCommentBody {
  readonly content: string
}

/**
 * Validate create comment request body
 */
function validateCreateCommentBody(body: unknown): CreateCommentBody | undefined {
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

/**
 * Handle comment creation errors
 */
function handleCommentError(c: Context, error: unknown) {
  if (isAuthorizationError(error)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return c.json(
    { success: false, message: 'Failed to create comment', code: 'INTERNAL_ERROR' },
    500
  )
}

/**
 * Handle create comment on a record
 */
export async function handleCreateComment(c: Context, app: App) {
  const { session } = getTableContext(c)
  const tableId = c.req.param('tableId')
  const recordId = c.req.param('recordId')

  // Find table by ID
  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Parse and validate request body
  const body = await c.req.json().catch(() => undefined)
  const validated = validateCreateCommentBody(body)

  if (!validated) {
    return c.json(
      { success: false, message: 'Invalid request body', code: 'VALIDATION_ERROR' },
      400
    )
  }

  // Create comment
  const program = createCommentProgram({
    session,
    tableId,
    recordId,
    tableName: table.name,
    content: validated.content,
  })

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return handleCommentError(c, result.left)
  }

  return c.json(result.right, 201)
}

/**
 * Handle delete comment error
 */
function handleDeleteCommentError(c: Context, error: unknown) {
  // Check for authorization errors
  if (isAuthorizationError(error)) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Forbidden error (user is not author and not admin)
    if (errorMessage.includes('Forbidden')) {
      return c.json({ success: false, code: 'FORBIDDEN' }, 403)
    }

    // Not found error (comment doesn't exist, already deleted, or no record access)
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Internal server error
  return c.json(
    { success: false, message: 'Failed to delete comment', code: 'INTERNAL_ERROR' },
    500
  )
}

/**
 * Handle delete comment
 */
export async function handleDeleteComment(c: Context, app: App) {
  const { session } = getTableContext(c)
  const tableId = c.req.param('tableId')
  const commentId = c.req.param('commentId')

  // Find table by ID
  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Delete comment
  const program = deleteCommentProgram({
    session,
    commentId,
    tableName: table.name,
  })

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return handleDeleteCommentError(c, result.left)
  }

  // Return 204 No Content on success
  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

/**
 * Handle get comment by ID
 */
export async function handleGetComment(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')
  const commentId = c.req.param('commentId')

  // Find table by ID
  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Check read permission
  if (!hasReadPermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // Get comment
  const program = getCommentProgram({
    session,
    commentId,
    tableName: table.name,
  })

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.right, 200)
}

/**
 * Handle list comments for a record
 */
export async function handleListComments(c: Context, app: App) {
  const { session } = getTableContext(c)
  const tableId = c.req.param('tableId')
  const recordId = c.req.param('recordId')

  // Find table by ID
  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Parse query parameters
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const sortParam = c.req.query('sort')

  const limit = limitParam ? Number(limitParam) : undefined
  const offset = offsetParam ? Number(offsetParam) : undefined

  // Parse sort parameter (e.g., "createdAt:asc" or "createdAt:desc")
  let sortOrder: 'asc' | 'desc' | undefined
  if (sortParam) {
    const [field, order] = sortParam.split(':')
    if (field === 'createdAt' && (order === 'asc' || order === 'desc')) {
      sortOrder = order
    }
  }

  // List comments
  const program = listCommentsProgram({
    session,
    recordId,
    tableName: table.name,
    limit,
    offset,
    sortOrder,
  })

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.right, 200)
}
