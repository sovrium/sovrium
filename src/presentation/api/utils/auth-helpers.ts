/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { FieldError } from '@/domain/models/api/_shared/error'
import type { Context } from 'hono'


export const requireSession = (c: Context): { readonly userId: string } | undefined => {
  const session = getSessionContext(c)
  return session !== undefined ? { userId: session.userId } : undefined
}

export const unauthorized = (c: Context) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

export const forbidden = (c: Context, message?: string) =>
  c.json({ success: false, message: message ?? 'Insufficient permissions', code: 'FORBIDDEN' }, 403)

export const notFound = (c: Context, message?: string) =>
  c.json({ success: false, message: message ?? 'Resource not found', code: 'NOT_FOUND' }, 404)

export const validationError = (c: Context, errors: readonly FieldError[], message?: string) =>
  c.json(
    {
      success: false,
      message: message ?? 'One or more fields failed validation',
      code: 'VALIDATION_ERROR',
      errors,
    },
    400
  )
