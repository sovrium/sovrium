/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  classifyDriverFailure,
  CONSTRAINT_MESSAGES,
  type ConstraintViolationClass,
} from '@/domain/errors/driver-failure'
import { DatabaseError, ValidationError } from '@/infrastructure/database'

/* eslint-disable functional/prefer-immutable-types -- Error handler factories for Effect.tryPromise catch: returns mutable Error class instances, parameter signature fixed as (error: unknown) by Effect API */

/**
 * Create a catch handler that preserves known error types and wraps unknowns in DatabaseError.
 *
 * Replaces the repeated pattern:
 * ```
 * catch: (error) =>
 *   error instanceof DatabaseError ? error
 *     : new DatabaseError(message, error)
 * ```
 *
 * @param message - Error message for wrapping unknown errors
 * @returns A catch handler suitable for Effect.tryPromise
 */
export function wrapDatabaseError(message: string): (error: unknown) => DatabaseError {
  return (error: unknown): DatabaseError =>
    error instanceof DatabaseError ? error : new DatabaseError(message, error)
}

/**
 * Create a catch handler that preserves DatabaseError and ValidationError,
 * wrapping all other errors in DatabaseError.
 *
 * Used in batch operations where ValidationError may propagate from inner Effect programs.
 *
 * @param message - Error message for wrapping unknown errors
 * @returns A catch handler suitable for Effect.tryPromise
 */
export function wrapDatabaseErrorWithValidation(
  message: string
): (error: unknown) => DatabaseError | ValidationError {
  return (error: unknown): DatabaseError | ValidationError => {
    if (error instanceof DatabaseError) return error
    if (error instanceof ValidationError) return error
    return new DatabaseError(message, error)
  }
}

/**
 * Which constraint classes this seam answers for ITSELF, and which it forwards.
 *
 * `true` — convert here, inside the transaction, into a `ValidationError`
 * carrying the client-safe wording. These classes mean "the database rejected
 * the caller's VALUE against a declared rule about that value", which every
 * batch caller already treats as a 400 with a `details` array.
 *
 * `false` — forward with the `cause` intact and let the API boundary decide.
 * `unique` is the only member, and it is not an exception to the rule so much as
 * the reason the rule needs a table: a uniqueness collision is a clash with
 * EXISTING STATE, not a malformed value, so it answers **409 Conflict** — which
 * is what `CONSTRAINT_ERROR_CODES` in the error sanitizer has always said, and
 * what the single-record write path has always emitted. Converting it here would
 * answer 400, because `ValidationError` carries no `cause` and so cannot be
 * reclassified downstream: the batch framing of one condition would need a
 * second client handler purely because it was batched.
 *
 * `satisfies Record<ConstraintViolationClass, boolean>` is load-bearing: adding
 * a constraint class fails to compile until someone decides which side of this
 * line it falls on.
 */
const CONVERTED_HERE = {
  unique: false,
  check: true,
  'foreign-key': true,
  'not-null': true,
} satisfies Record<ConstraintViolationClass, boolean>

/**
 * Create a catch handler for a WRITE STATEMENT — one that must never let the
 * driver's own text become the failure's message.
 *
 * The batch write statements each carried their own handler that re-threw the
 * driver error as `new ValidationError(driverError.message, [])`. That is the
 * disclosure: `sanitizeError`'s `case 'ValidationError'` echoes the message
 * VERBATIM, so a rejected write answered with `NOT NULL constraint failed:
 * <table>.<column>` on SQLite, and with drizzle's `Failed query: <SQL>` plus the
 * caller's own bound `params:` on PostgreSQL. The wrap also DESTROYED the
 * evidence — `ValidationError` carries no `cause` — so nothing downstream could
 * recover the failure and reclassify it.
 *
 * Each of those handlers also opened with a `code === '23502'` /
 * `message.includes('null value in column')` pre-check meant to catch NOT NULL
 * violations. Both tests were dead on both engines: `bun:sql` reports the
 * SQLSTATE on `errno` and never on `code` (see `driver-failure.ts`) and hands up
 * a drizzle-wrapped message, while `bun:sqlite` writes `NOT NULL constraint
 * failed: …`. Neither guard could ever fire, which is precisely why the verbatim
 * echo beneath them was reached every time.
 *
 * Classification now happens once, on the driver's own result code, through the
 * shared {@link classifyDriverFailure}:
 *
 * - a constraint listed in {@link CONVERTED_HERE} becomes a `ValidationError`
 *   carrying the wording from the single {@link CONSTRAINT_MESSAGES} table.
 * - any OTHER driver failure — a uniqueness collision, an operator fault, or a
 *   rejection of the caller's field name or literal — becomes a `DatabaseError`,
 *   which carries `cause`, so the chain survives to `sanitizeError` and is
 *   classified there. Nothing is guessed here.
 * - anything else never came from the driver at all: it is one of Sovrium's own
 *   throws (`validateColumnName` rejecting an identifier), whose message we
 *   wrote and can safely echo.
 *
 * @param message - server-side log context for the non-constraint wrap. It never
 *   reaches the client: a driver-originated failure is answered from
 *   `CONSTRAINT_MESSAGES`, from the caller-input table, or as a generic 500.
 */
export function wrapWriteStatementError(
  message: string
): (error: unknown) => DatabaseError | ValidationError {
  return (error: unknown): DatabaseError | ValidationError => {
    if (error instanceof DatabaseError) return error
    if (error instanceof ValidationError) return error

    const failure = classifyDriverFailure(error)
    if (failure.origin === 'constraint' && CONVERTED_HERE[failure.violation]) {
      return new ValidationError(CONSTRAINT_MESSAGES[failure.violation], [])
    }
    if (failure.origin === 'application') {
      return new ValidationError(error instanceof Error ? error.message : String(error), [])
    }
    return new DatabaseError(message, error)
  }
}
