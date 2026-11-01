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
 * The payoff would have been ten `eslint-disable` escapes. The `_tag` IS
 * read — `Effect.catchTag('NotFoundError', …)` in the calendar feed use-case,
 * and `error-sanitizer.ts`'s `mapTaggedError` switching on these names — so a
 * conversion would keep that contract; what it would change is the
 * serialization above. `sanitizeError` still classifies a DRIVER failure by
 * walking the `cause` chain (`classifyDriverFailure`), not by tag. If you
 * revisit this, start from that trade, not from "converge on one idiom".
 *
 * `field-rule-error.ts` is the converted exception: the four refusals a
 * record write's field rules answer with are `Data.TaggedError`s, and the one
 * carrying a `cause` (`FieldStorageError`) overrides `toJSON` to leave it out.
 *
 * `create-tagged-error.ts` is a THIRD, unrelated pattern (a plain
 * `{ _tag, cause }` object that does not extend `Error`) with 13 usages
 * elsewhere. Do not fold it in here; that would change `instanceof Error` for
 * all of them.
 */

export { DatabaseError } from './database-error'
export { NotFoundError } from './not-found-error'
export { StaleWriteError } from './stale-write-error'
export {
  BusinessRuleViolationError,
  isBusinessRuleViolationError,
  type BusinessRuleViolation,
} from './business-rule-violation-error'
export {
  FieldFormatViolationError,
  isFieldFormatViolationError,
  type FieldFormatViolationEntry,
} from './field-format-violation-error'
export { ForbiddenError } from './forbidden-error'
export { UniqueConstraintViolationError } from './unique-constraint-violation-error'
export { ForeignKeyViolationError } from './foreign-key-violation-error'
export { ValidationError } from './validation-error'
export { UncompilableFilterOperatorError } from './uncompilable-filter-operator-error'
export { UnknownFilterFieldError } from './unknown-filter-field-error'
export {
  OPERATOR_FIXES,
  OPERATOR_FIX_GUIDANCE,
  isOperatorFix,
  operatorFixOf,
  type OperatorFix,
} from './operator-fixable-error'
