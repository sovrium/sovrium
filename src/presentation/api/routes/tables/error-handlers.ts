/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Context } from 'hono'

export function handleRouteError(c: Context, error: unknown): Response {
  const requestId = (c.get('requestId') as string | undefined) ?? crypto.randomUUID()
  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  return c.json(
    {
      success: false,
      message: sanitized.message,
      code: sanitized.code,
    },
    statusCode
  )
}

export function handleRestoreRecordError(c: Context, error: unknown): Response {
  const errorMessage = error instanceof Error ? error.message : String(error)
  if (errorMessage === 'Record is not deleted') {
    return c.json(
      { success: false, message: 'Record is not deleted', code: 'VALIDATION_ERROR' },
      400
    )
  }

  return handleRouteError(c, error)
}
