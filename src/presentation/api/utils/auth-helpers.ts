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
 * drift) across `share-links/` and `connections/`
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
 * Canonical 401 response. Always returns the same envelope so clients
 * (and E2E specs) can rely on a single shape across all routes.
 */
export const unauthorized = (c: Context) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

/**
 * The outcome of {@link requireSession}: either a session, or the 401 to return.
 *
 * A discriminated union rather than `T | undefined` on purpose. The predecessor
 * returned `{ userId } | undefined` — a shape that ENFORCES nothing despite its
 * name, because a caller who forgets the `if (!session)` line gets a silent
 * `undefined` and carries on. `api-routes.ts` applies `authMiddleware` without
 * `requireAuth` on eight prefixes under a standing convention that "the handler
 * returns 401 itself", and the audit found six of the eight did not. A name
 * that says `require` and a type that does not is exactly how a convention
 * decays.
 *
 * The session is unreachable without narrowing on `ok`, so the 401 cannot be
 * skipped by omission — only by writing code that visibly discards it.
 */
export type RequiredSession =
  | { readonly ok: true; readonly session: { readonly userId: string } }
  | { readonly ok: false; readonly response: Response }

/**
 * Demand a session, or produce the canonical 401.
 *
 * For routes carrying `authMiddleware` but NOT `requireAuth` — those that must
 * stay reachable anonymously for SOME paths while gating others. A route that
 * is gated on EVERY path belongs behind `requireAuth()` in `api-routes.ts`
 * instead; this helper is for the mixed case.
 *
 * Usage:
 * ```ts
 * const auth = requireSession(c)
 * if (!auth.ok) return auth.response
 * // auth.session.userId is available from here
 * ```
 *
 * A route that genuinely wants to BRANCH on anonymity — a public form, a
 * favourites-boost that degrades gracefully — wants `getSessionContext`, which
 * says what it does.
 */
export const requireSession = (c: Context): RequiredSession => {
  const session = getSessionContext(c)
  if (session === undefined) return { ok: false, response: unauthorized(c) }
  return { ok: true, session: { userId: session.userId } }
}

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
 * Canonical 413 response for a request body that exceeds a declared limit.
 *
 * The `message` is overridable so callers keep their limit-specific wording
 * (e.g. 'Batch size exceeds maximum of 1000 records', or a byte-count string
 * naming the exact cap), while the envelope shape and `code` stay locked.
 *
 * Replaces five hand-rolled copies of this envelope across `batch-routes.ts`,
 * `batch-permission-helpers.ts`, `admin/buckets.ts` and `buckets/signed-urls.ts`
 * — two of which had drifted (`{ success, error, code }` with no `message`),
 * which fails the `expect413PayloadTooLarge` spec fixture because `message` is
 * required by `errorResponseSchema`.
 */
export const payloadTooLarge = (c: Context, message?: string) =>
  c.json(
    { success: false, message: message ?? 'Payload too large', code: 'PAYLOAD_TOO_LARGE' },
    413
  )

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
