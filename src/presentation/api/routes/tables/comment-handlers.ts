/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database/session-context'
import { createCommentProgram } from '@/application/use-cases/tables/comment-programs'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { Context } from 'hono'
import type { App } from '@/domain/models/app'

/**
 * Create comment request validation
 */
interface CreateCommentBody {
  readonly content: string
}

/**
 * Validate create comment request body
 */
function validateCreateCommentBody(body: unknown): CreateCommentBody | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const { content } = body as Record<string, unknown>

  if (typeof content !== 'string') {
    return null
  }

  if (content.length === 0) {
    return null
  }

  if (content.length > 10_000) {
    return null
  }

  return { content }
}

/**
 * Handle create comment on a record
 */
export async function handleCreateComment(c: Context, app: App) {
  const { session } = getTableContext(c)

  // Get path parameters
  const tableId = c.req.param('tableId')
  const recordId = c.req.param('recordId')

  // Find table by ID
  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // Parse and validate request body
  const body = await c.req.json().catch(() => null)
  const validated = validateCreateCommentBody(body)

  if (!validated) {
    return c.json(
      {
        success: false,
        message: 'Invalid request body',
        code: 'VALIDATION_ERROR',
      },
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
    const error = result.left

    // Record not found or access denied (return 404 to prevent enumeration)
    if (error instanceof SessionContextError && error.message.includes('Record not found')) {
      return c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }

    // Other errors
    return c.json(
      {
        success: false,
        message: 'Failed to create comment',
        code: 'INTERNAL_ERROR',
      },
      500
    )
  }

  // Return success response
  return c.json(result.right, 201)
}
