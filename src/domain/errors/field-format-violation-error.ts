/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record write one of whose values breaks its column's format — an `email`
 * column given something that is not an address, a `url` column given
 * something that is not an absolute web address. Raised by the write
 * orchestrations, which every road a record is written through passes
 * (`record-write-values-validation.ts`), so the refusal is the same whatever
 * the road.
 *
 * The records API answers it `422 VALIDATION_ERROR`, the first violation's
 * field and sentence at the top and every violation in `errors`; the MCP tools
 * answer it as invalid params; an automation step fails its run with its
 * message. Its messages name a column of the app's own config and never echo
 * the value (S4). It carries no `cause`: nothing failed underneath it.
 */

/** One value that breaks its column's format. */
export interface FieldFormatViolationEntry {
  readonly field: string
  readonly message: string
  /** Position of the row in a bulk write, counted from 0. */
  readonly index?: number
}

export class FieldFormatViolationError extends Error {
  readonly _tag = 'FieldFormatViolationError'
  readonly field: string
  readonly violations: readonly FieldFormatViolationEntry[]

  constructor(violations: readonly FieldFormatViolationEntry[]) {
    super(violations[0]?.message ?? 'A value does not match its field format')
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'FieldFormatViolationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.field = violations[0]?.field ?? ''
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.violations = violations
  }
}

/** Narrow a caught value to a format refusal. Pure. */
export const isFieldFormatViolationError = (error: unknown): error is FieldFormatViolationError =>
  error instanceof FieldFormatViolationError ||
  (typeof error === 'object' &&
    error !== null &&
    (error as { readonly _tag?: unknown })._tag === 'FieldFormatViolationError')
