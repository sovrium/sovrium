/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Session } from '@/application/ports/models/user-session'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'


export type { Session }


const AUTH_KEYWORDS = ['not found', 'access denied'] as const


export const getTableNameFromId = (app: App, tableId: string): string | undefined => {
  const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)
  return table?.name
}

const containsAuthKeywords = (text: string): boolean =>
  AUTH_KEYWORDS.some((keyword) => text.includes(keyword))

const extractErrorDetails = (
  error: unknown
): { message: string; name: string; causeMessage: string; errorString: string } => {
  const errorMessage = error instanceof Error ? error.message : ''
  const errorName = error instanceof Error ? error.name : ''
  const errorString = String(error)
  const causeMessage =
    error instanceof Error && 'cause' in error && error.cause instanceof Error
      ? error.cause.message
      : ''

  return { message: errorMessage, name: errorName, causeMessage, errorString }
}

export const isAuthorizationError = (error: unknown): boolean => {
  const { message, name, causeMessage, errorString } = extractErrorDetails(error)

  return (
    containsAuthKeywords(message) ||
    containsAuthKeywords(causeMessage) ||
    name.includes('SessionContextError') ||
    errorString.includes('SessionContextError')
  )
}

export const handleBatchRestoreError = (c: Context, error: unknown) => {
  if (error instanceof Error && error.name === 'ForbiddenError') {
    return c.json(
      {
        success: false,
        message: error.message,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error'

  if (errorMessage.includes('not found')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) not found/)
    const recordId = recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
        recordId,
      },
      404
    )
  }

  if (errorMessage.includes('is not deleted')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) is not deleted/)
    const recordId = recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined
    return c.json(
      {
        success: false,
        message: 'Record is not deleted',
        code: 'BAD_REQUEST',
        recordId,
      },
      400
    )
  }

  return c.json({ success: false, message: errorMessage, code: 'INTERNAL_ERROR' }, 500)
}


export const getSessionFromContext = (c: Context): Readonly<Session> | undefined => {
  return getSessionContext(c)
}

export const validateAndGetTableName = (app: App, tableId: string): string | undefined => {
  return getTableNameFromId(app, tableId)
}
