/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NotFoundError } from '@/domain/errors'
import { isDriverOriginatedFailure } from '@/domain/errors/driver-failure'
import { handleRouteError } from './error-handlers'
import type { Context } from 'hono'

// ============================================================================
// Table ID Resolution
// ============================================================================

/**
 * Extract error details from an error object
 * Centralizes error information extraction logic
 */
const extractErrorDetails = (error: unknown): { name: string; errorString: string } => {
  const errorName = error instanceof Error ? error.name : ''
  const errorString = String(error)

  return { name: errorName, errorString }
}

/**
 * Check if error is an authorization denial or a genuinely absent resource —
 * i.e. one of the two classes S1 collapses to an indistinguishable 404.
 *
 * The driver guard is the load-bearing line. The class formerly called
 * `SessionContextError` was OVERLOADED: application programs constructed it to
 * mean "absent" or "forbidden", while `wrapDatabaseError` constructed it to
 * wrap a raw driver failure. Matching on the class name alone therefore read a
 * dropped table, a lost connection or a datatype mismatch as an authorization
 * denial and answered 404 — telling the caller a record they can plainly see
 * does not exist, and handing the operator a non-alerting 404 while the
 * database is on fire.
 *
 * Excluding driver-raised failures FIRST is what makes the remaining checks
 * sound: whatever survives the guard provably never reached the database, so
 * it can only be one of Sovrium's own semantic outcomes.
 *
 * The semantic half of that split has landed: absences and denials arrive as
 * {@link NotFoundError} / `ForbiddenError` and are matched by name, not by
 * prose. `DatabaseError` now means only "a data-layer failure", which is why
 * the name test below is EXACT — `.includes('DatabaseError')` would also catch
 * `AuthDatabaseError`, `AccountDatabaseError`, `BootstrapDatabaseError` and a
 * dozen other scoped siblings, silently promoting their failures to 404.
 *
 * Only three classes reach this function at its four call sites
 * (`record-update-handler`, `comment-create-handler`, and two in
 * `comment-handlers`): `DatabaseError`, `NotFoundError`, `ForbiddenError`.
 * Every feeding program declares a closed `E` channel and `Effect.either`
 * captures only that channel — a defect rejects the promise and reaches
 * `handleRouteError` instead. The first two are matched by name above; every
 * remaining value is named literally `DatabaseError` and is decided by the
 * final arm. No reachable value is classified by its prose, which is why the
 * message-substring checks that used to sit here were deleted (2026-07-26).
 *
 * That final arm is what preserves the last untyped 404 on this path.
 * `executeRecordUpdateCRUD` throws a bare `Error` when `result.length === 0`,
 * and its own `catch` re-wraps it as a `DatabaseError` — so a PATCH against an
 * id that does not exist is classified HERE, on the class name. The UPDATE it
 * guards carries no predicate but `WHERE id = $1`: Sovrium has no row-level
 * security, and row- and field-level permissions are enforced in the
 * application layer, so an empty result means "no row with that id" and
 * nothing else. `[internal ref]` and `[internal ref]` both rest
 * solely on this arm — narrowing it is what the suite catches from here on.
 *
 * ⚠️ `TableNotFoundError` is the one class in the codebase that would genuinely
 * depend on prose matching: it is named `TableNotFoundError` and carries the
 * message `'Table not found'`, so it holds the keyword the retired text checks
 * looked for while matching neither name test. It cannot reach these four call
 * sites today — only the table/view metadata and listing programs raise it. If
 * any call site is ever widened to cover those, the correct fix is to extend
 * the typed-name test, never to reinstate prose matching.
 *
 * @param error - The error to check
 * @returns true if error is authorization-related (should return 404 instead of 500)
 */
export const isAuthorizationError = (error: unknown): boolean => {
  // An infrastructure fault is never an authorization denial, whatever
  // wrapper class carries it.
  if (isDriverOriginatedFailure(error)) return false

  const { name, errorString } = extractErrorDetails(error)

  // Typed outcomes, preferred over any text matching. `NotFoundError` and
  // `ForbiddenError` are the two classes S1 deliberately collapses to an
  // indistinguishable 404, and both now arrive tagged.
  if (name === 'ForbiddenError' || name === 'NotFoundError') return true

  // Remaining `DatabaseError`s are Sovrium's own semantic failures: the
  // driver-wrapped half was excluded by the guard above.
  //
  // EXACT, not `.includes()`. Every scoped sibling (`AuthDatabaseError`,
  // `AccountDatabaseError`, `BootstrapDatabaseError`, …) ends in the same
  // suffix, so a substring test would collapse all of them into a 404.
  // `String(error)` on an Error yields `${name}: ${message}`, hence the
  // `:` anchor on the stringified fallback.
  return name === 'DatabaseError' || errorString.startsWith('DatabaseError:')
}

/**
 * Handle batch restore errors with appropriate HTTP responses.
 *
 * The not-found branch is now TYPED. `validateAndFilterRecordsForRestore`
 * raises a {@link NotFoundError} carrying the offending `recordId`, and
 * `batchRestoreRecords` preserves it instead of flattening it into a
 * `DatabaseError`, so this handler matches a `_tag` and reads the id off
 * the error rather than substring-matching prose and regexing the id back out
 * of a formatted message.
 *
 * That retires the previous arrangement, where an explicit
 * `isDriverOriginatedFailure` guard had to run FIRST purely to stop an
 * infrastructure fault reaching a `.includes('not found')` test. With no
 * message matching left, that guard is redundant here and has been dropped:
 * anything that is not a typed absence falls through to `handleRouteError` →
 * `sanitizeError`, which classifies driver failures itself and answers an
 * alertable, SQL-free 500. Ordering is no longer load-bearing.
 *
 * The former `is not deleted` branch is REMOVED rather than typed: it had no
 * producer on this path. `validateAndFilterRecordsForRestore` only ever raises
 * "not found", and it FILTERS live records out instead of rejecting them
 * (restoring a live record returns `200 {restored: 0}`). The 400 for that case
 * comes from the single-record route, which now fails with a typed
 * `ValidationError` handled by the shared sanitizer.
 *
 * The 500 fallback goes through `handleRouteError` → `sanitizeError`, the
 * single canonical sanitizer. It previously returned the raw `error.message`,
 * which on a driver failure is drizzle's `Failed query: SELECT id, deleted_at
 * FROM "tasks" WHERE id = $1` — shipping the statement, the table name and the
 * column list to an unprivileged caller (standing rule S4).
 */
export const handleBatchRestoreError = (c: Context, error: unknown) => {
  // Handle ForbiddenError (viewer role attempting write operation)
  // Use name check to handle multiple import paths resolving to different class instances.
  // S1 anti-enumeration: authorization denials return 404 so the caller cannot
  // distinguish "exists but forbidden" from "doesn't exist".
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

  // A record the validator proved absent. `recordId` is reported as a number
  // to match the wire shape asserted by `restore-and-query.spec.ts`
  // (`expect(data.recordId).toBe(9999)`); ids arrive as strings.
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

  // Everything else — driver faults included — is classified and sanitized by
  // the shared handler.
  return handleRouteError(c, error)
}
