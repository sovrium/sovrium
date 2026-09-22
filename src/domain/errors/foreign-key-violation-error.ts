/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
