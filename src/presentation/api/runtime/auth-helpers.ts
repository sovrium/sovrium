/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { FieldError } from '@/domain/models/api/combinators/error'
import type { Context } from 'hono'

/**
 * Auth / error-envelope helpers for API route handlers.
 *
 * Centralises the canonical error envelopes so every route returns a
 * single, predictable shape that matches the OpenAPI schemas in
 * `src/domain/models/api/combinators/error.ts`:
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
 * in `src/domain/models/api/combinators/error.ts` — otherwise the response
 * will not type-check against the schema.
 */

/**
 * The canonical error BODY, for the routes that cannot use the fixed-status
 * helpers below.
 *
 * Three kinds of site need this rather than `notFound` / `badRequest` / friends:
 *
 * 1. **A status those helpers do not cover** — 405, 502, 504. The helper picks
 *    the status; this builder leaves it at the `c.json(body, status)` call.
 * 2. **An extra key the caller must keep** — `errors`, `allowed`, `opensAt`,
 *    `maxSubmissions`. Spread this and add it: `{ ...errorBody(…), opensAt }`.
 * 3. **An existing `error` reader that has to keep working.** This is the
 *    common one, and the reason `error` is a REQUIRED input here while
 *    `errorResponseSchema` leaves it optional. Before W8, 88 sites across 21
 *    files answered with `{ error }` alone, in three mutually incompatible
 *    dialects, and dozens of shipped specs read `body.error`. Dropping the key
 *    to reach the canonical shape would have rewritten the wire format of every
 * one of them — a spec change, owned by `[internal ref]`, not a
 *    refactor. So the repair is ADDITIVE: `message` and `code` arrive, `error`
 *    stays exactly as it was, and no reader of the old shape breaks.
 *
 * `message` defaults to `error` because the sentence dialect (`agents/*`,
 * `ai/*`) already put human-readable prose in `error` — there is nothing to
 * add, only a key to name it by. The slug dialect (`forms.ts`,
 * `webhook-handler.ts`) must pass both: `{ error: 'validation_failed', message:
 * 'Request body failed schema validation' }`, which is the shape the rule's own
 * docblock holds up as correct.
 *
 * Prefer a fixed-status helper below for a NEW route. Reach for this one when
 * one of the three reasons above applies, and say which.
 */
export const errorBody = (envelope: {
  readonly error: string
  readonly message?: string
  readonly code: ApiErrorCode
}) =>
  ({
    success: false,
    error: envelope.error,
    message: envelope.message ?? envelope.error,
    code: envelope.code,
  }) as const

/**
 * Canonical 401 response. Always returns the same envelope so clients
 * (and E2E specs) can rely on a single shape across all routes.
 */
export const unauthorized = (c: Context) =>
  c.json(
    { success: false, message: 'Authentication required', code: ApiErrorCode.UNAUTHORIZED },
    401
  )

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
  c.json(
    {
      success: false,
      message: message ?? 'Insufficient permissions',
      code: ApiErrorCode.FORBIDDEN,
    },
    403
  )

/**
 * Canonical 404 response. Mirrors the `forbidden`/`unauthorized` pattern
 * so that "the resource does not exist" responses use the same envelope
 * everywhere — replaces both inline `{ error: 'not_found' }` shapes and
 * ad-hoc `c.json({ success, message, code: 'NOT_FOUND' })` returns.
 */
export const notFound = (c: Context, message?: string) =>
  c.json(
    { success: false, message: message ?? 'Resource not found', code: ApiErrorCode.NOT_FOUND },
    404
  )

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
    {
      success: false,
      message: message ?? 'Payload too large',
      code: ApiErrorCode.PAYLOAD_TOO_LARGE,
    },
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
      code: ApiErrorCode.VALIDATION_ERROR,
      errors,
    },
    400
  )

/**
 * Canonical 400 response for a request the route refuses on shape grounds —
 * malformed JSON, a missing key, a value that is not the kind of thing the
 * endpoint accepts.
 *
 * `message` is REQUIRED, deliberately. The four copies this replaces each
 * carried their OWN default (`'Invalid view payload'`, `'Invalid preferences
 * payload'`, `'Invalid link payload'`, `'Invalid favorite payload'`), so giving
 * the shared helper any default would silently rewrite three of the four wire
 * bodies at the moment of consolidation. Forcing the caller to state its
 * wording keeps every existing response byte-identical and makes a future
 * divergence visible at the call site instead of hidden in a default.
 *
 * For a 400 carrying FIELD-level errors, use {@link validationError} instead —
 * that is the `VALIDATION_ERROR` envelope with an `errors[]` array, which is
 * what drives client-side form rendering.
 */
export const badRequest = (c: Context, message: string) =>
  c.json({ success: false, message, code: ApiErrorCode.BAD_REQUEST }, 400)

/**
 * Canonical 409 response for a write that clashes with existing state — a
 * uniqueness collision, a duplicate name.
 *
 * `message` is required for the same reason as {@link badRequest}: the wording
 * names WHICH collision occurred and is the only actionable part of the body.
 *
 * A route whose conflicts carry a machine-readable discriminant the client
 * branches on (rather than prose it merely displays) wants its own typed
 * envelope instead — see `admin/links.ts`, whose 409 ships a `LinkMutationConflictCode`
 * and is decoded against its own schema.
 */
export const conflict = (c: Context, message: string) =>
  c.json({ success: false, message, code: ApiErrorCode.CONFLICT }, 409)

/**
 * Canonical 500 response.
 *
 * Unlike its two neighbours above, this one DOES default: all four copies it
 * replaces emitted exactly `'Internal server error'`, so the default is
 * byte-identical everywhere and the override exists only for the routes that
 * already said something more specific (`admin/links.ts` names which read
 * failed).
 *
 * The message must stay generic enough to leak nothing about the failure —
 * never a driver string, a column name, or a query fragment (standing rule S4).
 * A route that wants an error MAPPED from a tagged failure rather than a
 * hand-written 500 should use `runEffect` or `handleRouteError`, both of which
 * run the full `sanitizeError` table.
 */
export const internalError = (c: Context, message = 'Internal server error') =>
  c.json({ success: false, message, code: ApiErrorCode.INTERNAL_ERROR }, 500)

/**
 * Error BODY (not a response) for the storage routes, which emit their own
 * status alongside it.
 *
 * These routes shipped `{ success, error, code }`: the one field
 * `errorResponseSchema` REQUIRES — `message` — absent, and the one it leaves
 * OPTIONAL — `error` — carrying the text in its place. So the status and the
 * code were right and the envelope around them was not, which is why nothing
 * caught it: every spec that read `body.error` passed.
 *
 * The repair is additive. `message` carries the text and `error` keeps it, so
 * no consumer of the previous shape breaks — that is the whole reason this is a
 * separate builder rather than a switch to {@link notFound} / {@link badRequest}
 * / {@link unauthorized} above, which DROP `error` and would break the shipped
 * `[internal ref]-*` specs that assert on it.
 *
 * Prefer the plain helpers for a NEW route. Reach for this one only where an
 * existing `error` reader has to keep working.
 *
 * Returns a body rather than a `Response` because several call sites embed it
 * in a `{ status, body }` descriptor or pick the status from a ternary, and a
 * response builder cannot serve those without a second parameter that is
 * already right there at the `c.json(...)` call.
 *
 * It is the sentence case of {@link errorBody} — `message` and `error` carry
 * the same text — and is now expressed as such rather than as a second copy of
 * the same four keys. The storage routes keep the narrower two-argument
 * signature because that is what their five call sites read like; a new caller
 * outside `buckets/` wants `errorBody` directly.
 */
export const storageErrorBody = (message: string, code: ApiErrorCode) =>
  errorBody({ error: message, code })
