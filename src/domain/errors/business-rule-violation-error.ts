/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A write the table's business rules (`tables[].rules`) refuse: every rule it
 * broke, each with the author's message, the field it is about when there is
 * one, and — for a bulk write — which row broke it.
 *
 * Every transport answers it as `400 VALIDATION_ERROR`, the first violation's
 * message at the top and every violation in `errors`. It carries no `cause`:
 * nothing failed underneath it, and its messages are the app author's own text.
 */

/** One rule one row broke. */
export interface BusinessRuleViolation {
  readonly rule: string
  readonly field?: string
  readonly message: string
  /** Position of the row in a bulk write, counted from 0. */
  readonly index?: number
  /** Id of the row in a bulk write, when it has one. */
  readonly recordId?: string
}

export class BusinessRuleViolationError extends Error {
  readonly _tag = 'BusinessRuleViolationError'
  readonly tableName: string
  readonly violations: readonly BusinessRuleViolation[]

  constructor(tableName: string, violations: readonly BusinessRuleViolation[]) {
    super(violations[0]?.message ?? 'A business rule refused the write')
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'BusinessRuleViolationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.tableName = tableName
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.violations = violations
  }
}

/** Narrow a caught value to a business-rule refusal. Pure. */
export const isBusinessRuleViolationError = (error: unknown): error is BusinessRuleViolationError =>
  error instanceof BusinessRuleViolationError ||
  (typeof error === 'object' &&
    error !== null &&
    (error as { readonly _tag?: unknown })._tag === 'BusinessRuleViolationError')
