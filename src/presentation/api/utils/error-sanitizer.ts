/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  classifyDriverFailure,
  CONSTRAINT_MESSAGES,
  type CallerInputRejectionClass,
  type ConstraintViolationClass,
} from '@/domain/errors/driver-failure'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Sanitized error codes for client responses
 *
 * These codes are safe to expose to clients and map to standard HTTP status codes.
 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

/**
 * Sanitized error response for clients
 *
 * This interface ensures that only safe, user-friendly error information
 * is exposed to clients, preventing information disclosure vulnerabilities.
 */
export interface SanitizedError {
  readonly error: string
  readonly code: ErrorCode
  readonly message?: string
  readonly details?: readonly string[]
  /**
   * The submitted column a constraint rejection was about, when the write path
   * attributed it. Always a key of the caller's own payload — the guard lives
   * where the payload does (`wrapCreateRecordFailure`), because this seam
   * cannot see it (standing rule S4).
   */
  readonly field?: string
  /**
   * The same attribution in the accumulating shape every other field-scoped
   * rejection on this API already uses (`fieldErrorSchema`), so one client
   * decoder handles a rule refused ahead of the write and a rule refused BY
   * the write alike.
   */
  readonly errors?: readonly { readonly field: string; readonly message: string }[]
}

/**
 * Check if error indicates "not found".
 *
 * Single canonical answer to "is this a 404?" used by both the API error
 * sanitizer and storage download routes. Detects:
 *
 * - Generic message text: "not found", "access denied" (treated as 404 to
 *   avoid leaking the existence of protected resources)
 * - S3 SDK errors via name+message: `NoSuchKey` (name) and "The specified
 *   key does not exist." (message)
 * - Local filesystem ENOENT: "ENOENT" anywhere in name or message
 * - Other adapter conventions: "key does not exist"
 *
 * Both error name and message are inspected because the S3 SDK puts the
 * error class on `error.name` ("NoSuchKey"), while local/bytea adapters
 * encode the failure in the message text.
 */
export function isNotFoundError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  const name = (error instanceof Error ? error.name : '').toLowerCase()

  return (
    /not found|nosuchkey|enoent|key does not exist|access denied/.test(message) ||
    /nosuchkey|notfound|enoent/.test(name)
  )
}

/**
 * Error object with dynamic properties.
 *
 * `details` is deliberately `readonly unknown[]` and NOT `readonly string[]`.
 * The narrower type was a false claim about the runtime: `ValidationError`
 * carries `{ record, field, error }[]`, and an unchecked cast let that object
 * array flow straight into a response whose published OpenAPI contract declares
 * `details: z.array(z.string())` (`domain/models/api/_shared/error.ts:67`).
 *
 * Typing it honestly is what forces the projection below to exist. Do not narrow
 * it back — the compiler was the only thing that could have caught this, and the
 * old declaration is precisely what stopped it.
 */
interface ErrorObject {
  readonly toJSON?: () => {
    readonly cause?: {
      readonly failure?: {
        readonly _tag?: string
        readonly message?: string
        readonly details?: readonly unknown[]
      }
    }
  }
  readonly _tag?: string
  readonly message?: string
  readonly details?: readonly unknown[]
}

/**
 * Project an internal `details` array onto the `string[]` the wire contract
 * promises.
 *
 * Shapes seen in practice:
 * - `{ record, field, error }` — the batch validation entry. Rendered as
 *   `"<field>: <error>"`. Both halves are safe to expose: `field` is a column
 *   from the caller's own config, and `error` is one of our own constants.
 * - a plain string — passed through.
 * - anything else — dropped rather than stringified. `String({})` yields
 *   `"[object Object]"`, which is noise in a client-facing payload, and
 *   `JSON.stringify` would risk re-introducing whatever the object holds.
 *
 * Dropping individual entries is the safe default: `details` is advisory, so a
 * missing entry only degrades the message, while a leaked one is an S4
 * information disclosure.
 *
 * **Presence is preserved exactly.** An input array maps to an output array even
 * when every entry was dropped, and only a missing input yields a missing output.
 * This is not cosmetic: three batch specs assert `toHaveProperty('details')`, and
 * the pre-fix code satisfied them with an empty array from its fallthrough.
 * Collapsing an emptied array to `undefined` removes the key and breaks that
 * contract — measured, after doing exactly that.
 */
const toClientDetails = (
  details: readonly unknown[] | undefined
): readonly string[] | undefined => {
  if (!details) return undefined
  return details.flatMap((entry) => {
    if (typeof entry === 'string') return [entry]
    if (entry !== null && typeof entry === 'object') {
      const { field, error } = entry as { readonly field?: unknown; readonly error?: unknown }
      if (typeof field === 'string' && typeof error === 'string') return [`${field}: ${error}`]
      if (typeof error === 'string') return [error]
    }
    return []
  })
}

/**
 * Log error details for debugging (server-side only)
 */
function logErrorDetails(error: unknown, requestId: string | undefined): void {
  logError(`[API Error] requestId=${requestId}`, error)
  logDebug(`[API Error - error type] ${typeof error}`)
  logDebug(
    `[API Error - error own keys] ${error && typeof error === 'object' ? Object.keys(error).join(', ') : 'not an object'}`
  )
  logDebug(
    `[API Error - error all keys] ${error && typeof error === 'object' ? Object.getOwnPropertyNames(error).join(', ') : 'not an object'}`
  )
  const errObj = error as ErrorObject
  logDebug(`[API Error - error _tag] ${errObj._tag}`)
  logDebug(`[API Error - error message] ${errObj.message}`)
  logDebug(`[API Error - error details] ${JSON.stringify(errObj.details)}`)
}

/**
 * Extract actual error from Effect FiberFailure wrapper
 */
function extractActualError(error: unknown): ErrorObject {
  const errorObj = error as ErrorObject

  // Try to extract the error from FiberFailure via toJSON()
  if (errorObj && typeof errorObj === 'object' && errorObj.toJSON) {
    try {
      const jsonRep = errorObj.toJSON()
      if (jsonRep?.cause?.failure) {
        const actualError = jsonRep.cause.failure
        logDebug(
          `[API Error - extracted from toJSON cause.failure] _tag=${actualError._tag} message=${actualError.message} details=${JSON.stringify(actualError.details)}`
        )
        return actualError
      }
    } catch (e) {
      logDebug(`[API Error - toJSON extraction failed] ${e}`)
    }
  }

  return errorObj
}

/**
 * Map tagged error to sanitized response
 */
function mapTaggedError(errorTag: string, actualError: ErrorObject): SanitizedError | undefined {
  switch (errorTag) {
    case 'ForbiddenError':
    case 'ActivityLogForbiddenError':
      // S1 anti-enumeration: authorization denials are returned as 404 so the
      // caller cannot distinguish "exists but forbidden" from "doesn't exist".
      // All ForbiddenError throw sites in src/ are authz-related (verified by
      // domain/errors/index.ts docstring and audit of throw sites in
      // application/use-cases/tables/table-operations.ts and
      // application/use-cases/list-activity-logs.ts).
      return {
        error: 'Not Found',
        code: 'NOT_FOUND',
        message: 'Resource not found',
      }
    case 'ValidationError':
      return {
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        message: actualError.message ?? 'Invalid input data',
        // Projected, not passed through: the internal shape is an object array
        // and the wire contract is `string[]` — see `toClientDetails`.
        details: toClientDetails(actualError.details),
      }
    case 'UniqueConstraintViolationError':
      return {
        error: 'Conflict',
        code: 'CONFLICT',
        message: 'Resource already exists',
      }
    case 'NotFoundError':
    case 'TableNotFoundError':
      return {
        error: 'Not Found',
        code: 'NOT_FOUND',
        message: 'Resource not found',
      }
    default:
      return undefined
  }
}

/**
 * TOTAL constraint-class → wire-code table.
 *
 * `satisfies Record<ConstraintViolationClass, ErrorCode>` is the point: adding
 * a constraint class breaks THIS table at compile time, forcing an explicit
 * status decision instead of letting the new class fall through to whatever
 * the last heuristic happened to match.
 *
 * `foreign-key` and `not-null` join `check` on `VALIDATION_ERROR`: all three
 * mean "the database rejected the caller's VALUE against a declared rule about
 * that value", so all three are caller error. `unique` keeps `CONFLICT` because
 * a uniqueness collision is a clash with existing state rather than malformed
 * input.
 *
 * `not-null` had been left at `INTERNAL_ERROR`. A caller who sends an explicit
 * `null` for a field the config declares required passes the request-level
 * required-field check — which only looks for an ABSENT key — and is rejected by
 * the column instead, so the write answered 500 on both dialects. That is wrong
 * twice over: the caller is told the server broke when their own input was at
 * fault, and an ordinary bad request raises an alertable error for the operator.
 * The batch write path already answered 400 for the same violation, so this also
 * makes the two paths agree.
 */
const CONSTRAINT_ERROR_CODES = {
  unique: 'CONFLICT',
  check: 'VALIDATION_ERROR',
  'foreign-key': 'VALIDATION_ERROR',
  'not-null': 'VALIDATION_ERROR',
} satisfies Record<ConstraintViolationClass, ErrorCode>

/**
 * TOTAL caller-input-rejection → wire-message table.
 *
 * Every member is a 400: the database rejected the CALLER'S field name or
 * value. Splitting these out of the operator bucket stops ordinary bad input —
 * notably scanner and bot traffic putting garbage into record-id path segments,
 * which yields `22P02` forever — from raising an alertable 500 on every hit.
 *
 * They are deliberately NOT 404. Reporting "not found" for an unparseable id
 * would re-create the anti-enumeration disguise this whole change removes.
 *
 * Wording names the SHAPE of the problem without echoing the column, the value
 * or the driver text, all of which disclose schema (standing rule S4).
 */
const CALLER_INPUT_MESSAGES = {
  'undefined-column': 'A submitted field is not recognised for this resource',
  'data-exception': 'A submitted value has an invalid format for its field',
} satisfies Record<CallerInputRejectionClass, string>

const INTERNAL_ERROR: SanitizedError = {
  error: 'Internal Server Error',
  code: 'INTERNAL_ERROR',
  message: 'An unexpected error occurred. Please try again later.',
}

const SANITIZED_ERROR_TITLES = {
  CONFLICT: 'Conflict',
  VALIDATION_ERROR: 'Validation Error',
  INTERNAL_ERROR: 'Internal Server Error',
} satisfies Partial<Record<ErrorCode, string>>

/**
 * Map a database-driver failure to a sanitized response, or `undefined` when
 * the error never came from the driver (so the caller falls through to its own
 * semantic handling).
 *
 * Runs BEFORE {@link isNotFoundError} on purpose. An infrastructure fault must
 * never be answered as a 404: the caller is told a record they can plainly see
 * does not exist, and the operator's monitoring sees a non-alerting 404 while
 * the database is down.
 *
 * The switch has no `default`, so adding an origin to `DriverFailure` fails to
 * compile until it has been given a status here.
 */
function mapDriverFailure(error: unknown): SanitizedError | undefined {
  const failure = classifyDriverFailure(error)
  switch (failure.origin) {
    case 'constraint': {
      const code = CONSTRAINT_ERROR_CODES[failure.violation]
      const message = CONSTRAINT_MESSAGES[failure.violation]
      // The offending column, when the write path could attribute it to one the
      // caller actually submitted. Read structurally rather than by class so
      // any producer that recovers a column surfaces it the same way; absent
      // means "not attributed", and the class-level wording answers alone.
      const { fieldName } = error as { readonly fieldName?: unknown }
      const field = typeof fieldName === 'string' && fieldName.length > 0 ? fieldName : undefined
      return {
        error: SANITIZED_ERROR_TITLES[code],
        code,
        message,
        // Never derived from the driver's own text — `message` is the same
        // client-safe constant the class always answered with, so nothing here
        // can echo the constraint name, the CHECK expression, or the caller's
        // bound values (standing rule S4).
        ...(field ? { field, errors: [{ field, message }] } : {}),
      }
    }
    case 'caller-input':
      return {
        error: SANITIZED_ERROR_TITLES.VALIDATION_ERROR,
        code: 'VALIDATION_ERROR',
        message: CALLER_INPUT_MESSAGES[failure.rejection],
      }
    case 'operator':
      return INTERNAL_ERROR
    case 'application':
      return undefined
  }
}

/**
 * Sanitize errors for client responses
 *
 * ✅ Removes internal details (file paths, SQL, stack traces, database schemas)
 * ✅ Maps to generic error codes and user-safe messages
 * ✅ Logs full error server-side for debugging
 * ✅ Returns only information safe to expose to clients
 *
 * **Security Benefits:**
 * - Prevents database schema discovery through constraint errors
 * - Hides internal architecture (file paths, service URLs)
 * - Conceals SQL query structure
 * - Protects authorization logic details
 *
 * @param error - The error to sanitize
 * @param requestId - Optional request ID for correlation in logs
 * @returns Sanitized error safe for client consumption
 *
 * @example
 * ```typescript
 * try {
 *   await dangerousOperation()
 * } catch (error) {
 *   const sanitized = sanitizeError(error, requestId)
 *   return c.json(sanitized, getStatusCode(sanitized.code))
 * }
 * ```
 */
export function sanitizeError(error: unknown, requestId?: string): SanitizedError {
  logErrorDetails(error, requestId)

  const actualError = extractActualError(error)
  const errorTag = actualError._tag

  // Handle known safe error types
  if (errorTag) {
    const sanitized = mapTaggedError(errorTag, actualError)
    if (sanitized) return sanitized
  }

  // Classify against the database driver BEFORE any message-shaped matching:
  // a constraint rejection gets the status that describes it (identically on
  // both dialects), and any other driver failure stays an alertable 500.
  const driverFailure = mapDriverFailure(error)
  if (driverFailure) return driverFailure

  // Check for not-found patterns (includes access denied to avoid leaking existence)
  if (isNotFoundError(error)) {
    return {
      error: 'Not Found',
      code: 'NOT_FOUND',
      message: 'Resource not found',
    }
  }

  // Generic internal error (no details leaked to prevent information disclosure)
  return INTERNAL_ERROR
}

/**
 * Get HTTP status code for error code
 *
 * Maps sanitized error codes to appropriate HTTP status codes.
 *
 * @param code - The error code
 * @returns HTTP status code
 */
export function getStatusCode(code: ErrorCode): ContentfulStatusCode {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'VALIDATION_ERROR':
      return 400
    case 'CONFLICT':
      return 409
    case 'RATE_LIMITED':
      return 429
    case 'INTERNAL_ERROR':
      return 500
    case 'SERVICE_UNAVAILABLE':
      return 503
  }
}
