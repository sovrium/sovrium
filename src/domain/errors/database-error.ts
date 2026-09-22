/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
