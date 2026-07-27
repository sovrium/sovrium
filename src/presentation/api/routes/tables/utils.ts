/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NotFoundError } from '@/domain/errors'
import { isDriverOriginatedFailure } from '@/domain/errors/driver-failure'
import { handleRouteError } from './error-handlers'
import type { Session } from '@/application/ports/models/user-session'
import type { Context } from 'hono'


export type { Session }


const extractErrorDetails = (error: unknown): { name: string; errorString: string } => {
  const errorName = error instanceof Error ? error.name : ''
  const errorString = String(error)

  return { name: errorName, errorString }
}

export const isAuthorizationError = (error: unknown): boolean => {
  if (isDriverOriginatedFailure(error)) return false

  const { name, errorString } = extractErrorDetails(error)

  if (name === 'ForbiddenError' || name === 'NotFoundError') return true

  return name === 'DatabaseError' || errorString.startsWith('DatabaseError:')
}

export const handleBatchRestoreError = (c: Context, error: unknown) => {
  if (error instanceof Error && error.name === 'ForbiddenError') {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  if (error instanceof NotFoundError) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
        recordId: error.recordId === undefined ? undefined : Number.parseInt(error.recordId),
      },
      404
    )
  }

  return handleRouteError(c, error)
}
