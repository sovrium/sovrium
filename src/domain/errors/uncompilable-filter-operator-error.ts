/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A filter names an operator no filter compiles.
 *
 * The sibling of {@link UnknownFilterFieldError}, and handled like it: a
 * deterministic refusal to build a query, never a lost round-trip. So it
 * travels through the lenient id lookup untouched, a repository passes it
 * through instead of folding it into its database error, the API answers it
 * 400, and a run fails its step with the message. It is its own type because
 * its remedy differs: a field refusal lists the columns, this one the
 * operators.
 *
 * Raised by the run-time record-filter check and by the SQL compilers, which
 * fail closed on an operator they do not know rather than compiling it as
 * something else.
 */
export class UncompilableFilterOperatorError extends Error {
  readonly _tag = 'UncompilableFilterOperatorError'
  /** The refused operator, as it was written. */
  readonly operator: string
  /** The field the condition named, when the refusal knows it. */
  readonly field: string | undefined

  constructor(message: string, operator: string, field?: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'UncompilableFilterOperatorError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.operator = operator
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.field = field
  }
}
