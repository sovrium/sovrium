/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findConstraintFieldName } from '@/domain/errors/driver-failure'
import {
  ForeignKeyViolationError,
  DatabaseError,
  UniqueConstraintViolationError,
} from '@/infrastructure/database'
import {
  isForeignKeyViolation,
  isUniqueConstraintViolation,
} from '../mutation-helpers/create-record-helpers'

/**
 * Convert a failed INSERT into the typed failure the API boundary answers from.
 *
 * The interesting half is the COLUMN. A constraint rejection is the caller's
 * own value clashing with a rule their config declared, so the only useful
 * answer names which value — and the column name is recoverable because the
 * constraint name is OURS (`check_<column>_<suffix>`, `<table>_<column>_fkey`),
 * handed back by the driver on `constraint` under PostgreSQL and inside the
 * message text under SQLite.
 *
 * Recovery goes through the shared {@link findConstraintFieldName} rather than
 * a private regex ladder, and is restricted to columns the caller ACTUALLY
 * SUBMITTED. That guard is what makes the echo safe (standing rule S4) and what
 * makes it unambiguous: `created_by` and `updated_by` are injected from the
 * session after the payload is taken, so an FK failure on one of them names no
 * column at all instead of disclosing a column the caller never sent.
 *
 * Order is the contract, and it is the pre-existing one: foreign-key BEFORE
 * unique. PostgreSQL attaches a `constraint` name to FK violations too, so the
 * looser uniqueness test would otherwise claim them.
 *
 * [internal ref] / a forms spec.
 */
export function wrapCreateRecordFailure(
  error: unknown,
  tableName: string,
  submittedFields: readonly string[]
): DatabaseError | UniqueConstraintViolationError | ForeignKeyViolationError {
  if (error instanceof DatabaseError) return error
  if (error instanceof UniqueConstraintViolationError) return error
  if (error instanceof ForeignKeyViolationError) return error

  const fieldName = findConstraintFieldName(error, submittedFields)

  if (isForeignKeyViolation(error)) {
    const message = fieldName
      ? `referenced ${fieldName} does not exist`
      : 'referenced record does not exist'
    return new ForeignKeyViolationError(message, fieldName, error)
  }
  if (isUniqueConstraintViolation(error)) {
    return new UniqueConstraintViolationError('Unique constraint violation', error, fieldName)
  }
  // Everything else — including the CHECK and NOT NULL rejections this path
  // used to drop on the floor. The message is server-side log context only;
  // the client is answered from `CONSTRAINT_MESSAGES` by the sanitizer, which
  // reads `fieldName` off this error to name the offending column.
  return new DatabaseError(`Failed to create record in ${tableName}`, error, fieldName)
}
