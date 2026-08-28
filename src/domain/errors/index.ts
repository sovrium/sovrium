/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export { createTaggedError } from './create-tagged-error'

/**
 * WHY THESE ARE HAND-ROLLED AND NOT `Data.TaggedError`
 * ----------------------------------------------------
 * 92 files under `src/application` already use `Data.TaggedError`; the classes
 * below are the deliberate holdout. Converting them was assessed and REJECTED
 * (2026-07), for a security reason rather than inertia:
 *
 * `Data.TaggedError` gives every instance a `toJSON()` that SPREADS its own
 * args — including `cause` (see `Data.Error`'s `toJSON` in
 * `vendor/effect/packages/effect/src/Data.ts`). On {@link DatabaseError}
 * `cause` holds the raw driver error, whose message is drizzle's `Failed
 * query: SELECT … FROM "tasks" WHERE …`. Adding a serializer that spreads the
 * statement, the table name and the column list onto the hottest error path
 * re-opens the disclosure class deliberately removed from
 * `handleBatchRestoreError` (standing rule S4).
 *
 * It also interacts with `error-sanitizer.ts`'s `extractActualError`, which
 * branches on the PRESENCE of `toJSON` and then looks for `cause.failure`.
 * These classes have no `toJSON`, so they are returned directly today; a
 * conversion would silently reroute every one of them through that branch.
 *
 * The payoff would have been ten `eslint-disable` escapes and a `_tag` that
 * NOTHING reads — `sanitizeError` classifies these by walking the `cause`
 * chain (`classifyDriverFailure`), never by tag. If you revisit this, start
 * from that trade, not from "converge on one idiom".
 *
 * `create-tagged-error.ts` is a THIRD, unrelated pattern (a plain
 * `{ _tag, cause }` object that does not extend `Error`) with 13 usages
 * elsewhere. Do not fold it in here; that would change `instanceof Error` for
 * all of them.
 */

/**
 * Database session context error
 */
export class DatabaseError extends Error {
  readonly _tag = 'DatabaseError'
  override readonly cause?: unknown
  /**
   * The submitted COLUMN a constraint rejection was about, when the write path
   * could attribute it (`findConstraintFieldName`).
   *
   * Set only on the driver-wrap path, and only ever to a key of the caller's
   * own payload — never a column they did not send (standing rule S4). The API
   * boundary surfaces it as the response's `field`, so a caller fixing a
   * rejected write learns WHICH value the database refused rather than only
   * that one of them was.
   *
   * Optional because most `DatabaseError`s have no column to name: an operator
   * fault has none, and this class is also constructed for Sovrium's own
   * semantic failures. Absent means "not attributed", which the boundary
   * answers with the class-level wording alone.
   */
  readonly fieldName?: string

  constructor(message: string, cause?: unknown, fieldName?: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'DatabaseError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.cause = cause
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.fieldName = fieldName
  }
}

/**
 * A resource Sovrium itself determined is absent.
 *
 * This is the counterpart to {@link DatabaseError}, and the split is the
 * whole point of this class. `DatabaseError` was a catch-all that meant
 * BOTH "the driver failed" and "the record isn't there"; because its name reads
 * as an auth/session concept, `isAuthorizationError` treated the driver half as
 * an authorization signal and answered 404 for infrastructure faults — telling
 * a caller a record they can plainly see does not exist, while handing the
 * operator a non-alerting 404 with the database on fire.
 *
 * Producing this tag is what lets a boundary answer 404 from a `_tag` instead
 * of from a substring match on prose. `sanitizeError`'s `case 'NotFoundError'`
 * already existed as a landing pad with no producer; this is its producer.
 *
 * Deliberately carries NO `cause`. An absent record is never a wrapped driver
 * failure — anything with a driver underneath it is a {@link DatabaseError}
 * and must stay an alertable 500. Keeping `cause` off this class means a 404
 * response can never carry SQL text (standing rule S4).
 *
 * @param recordId - the specific record that was absent, when the caller named
 *   one. Lets the batch-restore response identify it WITHOUT re-parsing the id
 *   back out of a formatted message.
 */
export class NotFoundError extends Error {
  readonly _tag = 'NotFoundError'
  readonly recordId?: string

  constructor(message: string, recordId?: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'NotFoundError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.recordId = recordId
  }
}

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError'

  constructor(message: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ForbiddenError'
  }
}

/**
 * Unique constraint violation error
 * Thrown when attempting to insert/update a record that violates a unique constraint
 */
export class UniqueConstraintViolationError extends Error {
  readonly _tag = 'UniqueConstraintViolationError'
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'UniqueConstraintViolationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.cause = cause
  }
}

/**
 * Foreign-key constraint violation error
 * Thrown when an insert/update references a row that does not exist in the
 * referenced table (e.g. `user`-typed column receiving a non-existent user
 * id; the column auto-FKs to `auth_user.id`). The `fieldName` (optional)
 * lets the API layer surface a per-field error envelope without re-deriving
 * the column from the SQL error string.
 *
 * Bug 3 (sovrium-partner repro / [internal ref]).
 */
export class ForeignKeyViolationError extends Error {
  readonly _tag = 'ForeignKeyViolationError'
  override readonly cause?: unknown
  readonly fieldName?: string

  constructor(message: string, fieldName?: string, cause?: unknown) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ForeignKeyViolationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.fieldName = fieldName
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.cause = cause
  }
}

/**
 * Validation error for invalid input data
 * Thrown when input data fails validation before database operations
 */
export class ValidationError extends Error {
  readonly _tag = 'ValidationError'
  readonly details?: readonly {
    readonly record: number
    readonly field: string
    readonly error: string
  }[]

  constructor(
    message: string,
    details?: readonly { readonly record: number; readonly field: string; readonly error: string }[]
  ) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ValidationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.details = details
  }
}

/**
 * A record filter names a field that resolves to no column of its table.
 *
 * Distinct from {@link DatabaseError} because the two demand OPPOSITE handling
 * and the record actions already discriminate on that: a `DatabaseError` from a
 * filter lookup is a lost round-trip that five shipped operators deliberately
 * degrade to "matched nothing" (see `resolveIdsByFilterLenient`), whereas this
 * is a deterministic refusal to build a query at all. Retrying cannot change
 * it, and swallowing it re-opens exactly the hole the check closes — on SQLite
 * an unknown quoted identifier degrades to a string LITERAL, so the predicate
 * stops narrowing anything and a `record/delete` empties the table.
 *
 * It therefore travels through the lenient wrapper untouched and surfaces as a
 * failed action, so an operator learns their filter was wrong instead of
 * reading a clean run that did nothing (or everything).
 */
export class UnknownFilterFieldError extends Error {
  readonly _tag = 'UnknownFilterFieldError'
  /** The unresolvable field, so a caller can name it without re-parsing. */
  readonly field: string

  constructor(message: string, field: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'UnknownFilterFieldError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.field = field
  }
}
