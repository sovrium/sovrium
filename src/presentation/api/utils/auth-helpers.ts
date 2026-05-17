/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { FieldError } from '@/domain/models/api/_shared/error'
import type { Context } from 'hono'

/**
 * Auth / error-envelope helpers for API route handlers.
 *
 * Centralises the canonical error envelopes so every route returns a
 * single, predictable shape that matches the OpenAPI schemas in
 * `src/domain/models/api/_shared/error.ts`:
 *
 *   - `errorResponseSchema`           → { success: false, message, code }
 *   - `validationErrorResponseSchema` → { success: false, message, code: 'VALIDATION_ERROR', errors: [...] }
 *
 * These helpers were previously duplicated (with subtle wire-format
 * drift) across `notifications/`, `share-links/`, and `connections/`
 * route modules, plus inline `{ error, message }` shapes scattered
 * across `auth.ts`, `analytics.ts`, `batch-routes.ts`, etc. Routing
 * everything through this file keeps the envelopes locked.
 *
 * Coordination note: when adding a new helper here, also add the
 * corresponding `code` value to the `errorResponseSchema.code` enum
 * in `src/domain/models/api/_shared/error.ts` — otherwise the response
 * will not type-check against the schema.
 */

/**
 * Extract the current user's id from the request context, or `undefined`
 * if no session is present. Use in routes that have `authMiddleware`
 * applied but NOT `requireAuth` — i.e. routes that need to branch on
 * authenticated vs anonymous.
 */
export const requireSession = (c: Context): { readonly userId: string } | undefined => {
  const session = getSessionContext(c)
  return session !== undefined ? { userId: session.userId } : undefined
}

/**
 * Canonical 401 response. Always returns the same envelope so clients
 * (and E2E specs) can rely on a single shape across all routes.
 */
export const unauthorized = (c: Context) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

/**
 * Canonical 403 response. The `message` is overridable so callers can
 * preserve action-specific wording (e.g. 'Admin access required',
 * 'You do not have permission to delete records in this table'),
 * while the envelope shape and `code` stay locked.
 */
export const forbidden = (c: Context, message?: string) =>
  c.json({ success: false, message: message ?? 'Insufficient permissions', code: 'FORBIDDEN' }, 403)

/**
 * Canonical 404 response. Mirrors the `forbidden`/`unauthorized` pattern
 * so that "the resource does not exist" responses use the same envelope
 * everywhere — replaces both inline `{ error: 'not_found' }` shapes and
 * ad-hoc `c.json({ success, message, code: 'NOT_FOUND' })` returns.
 */
export const notFound = (c: Context, message?: string) =>
  c.json({ success: false, message: message ?? 'Resource not found', code: 'NOT_FOUND' }, 404)

/**
 * Canonical 400 validation-error response.
 *
 * Returns the `validationErrorResponseSchema` envelope:
 *   { success: false, message, code: 'VALIDATION_ERROR', errors: [{ field, message, code? }] }
 *
 * Callers always supply at least one `FieldError`. If you have a 400 that
 * is *not* per-field (e.g. malformed JSON body), use `errorResponseSchema`
 * with `code: 'BAD_REQUEST'` instead — this helper is specifically for the
 * field-level shape that drives client-side form error rendering.
 */
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
