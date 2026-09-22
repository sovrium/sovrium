/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
