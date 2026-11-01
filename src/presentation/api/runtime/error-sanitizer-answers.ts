/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two answers `error-sanitizer.ts` gives to a refusal of the caller's
 * VALUES: a database constraint, and a table's business rule. Both are a 4xx
 * about the request, attributed to a field when one can be named.
 */

import { CONSTRAINT_MESSAGES, type ConstraintViolationClass } from '@/domain/errors/driver-failure'

/** The codes a value refusal answers with. */
type ValueRefusalCode = 'CONFLICT' | 'VALIDATION_ERROR'

/** One attributed refusal, in the accumulating shape of `fieldErrorSchema`. */
export interface AnsweredFieldError {
  readonly field?: string
  readonly message: string
  readonly rule?: string
  readonly index?: number
  readonly recordId?: string
}

/** A value refusal, as `SanitizedError` carries it. */
export interface ValueRefusalAnswer {
  readonly error: string
  readonly code: ValueRefusalCode
  readonly message: string
  readonly field?: string
  readonly rule?: string
  readonly errors?: readonly AnsweredFieldError[]
}

const TITLES = { CONFLICT: 'Conflict', VALIDATION_ERROR: 'Validation Error' } as const

/**
 * TOTAL constraint-class → wire-code table.
 *
 * `satisfies Record<ConstraintViolationClass, …>` is the point: adding a
 * constraint class breaks THIS table at compile time, forcing an explicit
 * status decision instead of letting the new class fall through to whatever
 * the last heuristic happened to match.
 *
 * `foreign-key` and `not-null` join `check` on `VALIDATION_ERROR`: all three
 * mean "the database rejected the caller's VALUE against a declared rule about
 * that value", so all three are caller error. `unique` and `still-referenced`
 * (a delete of a row others still link to) answer `CONFLICT`: a clash with
 * existing state rather than malformed input.
 *
 * `not-null` had been left at `INTERNAL_ERROR`. A caller who sends an explicit
 * `null` for a field the config declares required passes the request-level
 * required-field check — which only looks for an ABSENT key — and is rejected by
 * the column instead, so the write answered 500 on both dialects. The batch
 * write path already answered 400 for it, so the two paths agree.
 */
const CONSTRAINT_ERROR_CODES = {
  unique: 'CONFLICT',
  check: 'VALIDATION_ERROR',
  'foreign-key': 'VALIDATION_ERROR',
  'still-referenced': 'CONFLICT',
  'not-null': 'VALIDATION_ERROR',
} satisfies Record<ConstraintViolationClass, ValueRefusalCode>

/**
 * The answer to a constraint rejection of the caller's value.
 *
 * The offending column is named when the write path could attribute it to one
 * the caller actually submitted. Read structurally rather than by class so any
 * producer that recovers a column surfaces it the same way; absent means "not
 * attributed", and the class-level wording answers alone. Never derived from
 * the driver's own text — `message` is the client-safe constant the class always
 * answers with, so nothing here can echo the constraint name, the CHECK
 * expression, or the caller's bound values (standing rule S4).
 */
export function constraintAnswer(
  violation: ConstraintViolationClass,
  error: unknown
): ValueRefusalAnswer {
  const code = CONSTRAINT_ERROR_CODES[violation]
  const message = CONSTRAINT_MESSAGES[violation]
  const { fieldName } = (error ?? {}) as { readonly fieldName?: unknown }
  const field = typeof fieldName === 'string' && fieldName.length > 0 ? fieldName : undefined
  return {
    error: TITLES[code],
    code,
    message,
    ...(field ? { field, errors: [{ field, message }] } : {}),
  }
}

/** The fields of one business-rule violation a client may be told. */
const answeredViolation = (entry: unknown): AnsweredFieldError | undefined => {
  if (entry === null || typeof entry !== 'object') return undefined
  const { rule, field, message, index, recordId } = entry as Readonly<Record<string, unknown>>
  if (typeof rule !== 'string' || typeof message !== 'string') return undefined
  return {
    rule,
    message,
    ...(typeof field === 'string' ? { field } : {}),
    ...(typeof index === 'number' ? { index } : {}),
    ...(recordId === undefined || recordId === null ? {} : { recordId: String(recordId) }),
  }
}

/**
 * The answer to a write a table's business rules refused: `400
 * VALIDATION_ERROR`, the first violation's message, rule and field at the top,
 * and every violation in `errors`. The messages are the app author's own text,
 * and a field is one the writer sent or the rule names, so nothing here echoes
 * a stored value (S4). A blocked delete names no field.
 */
export function businessRuleAnswer(error: unknown): ValueRefusalAnswer {
  const { violations } = (error ?? {}) as { readonly violations?: unknown }
  const errors = (Array.isArray(violations) ? violations : []).flatMap((entry: unknown) => {
    const answered = answeredViolation(entry)
    return answered === undefined ? [] : [answered]
  })
  const [first] = errors
  return {
    error: TITLES.VALIDATION_ERROR,
    code: 'VALIDATION_ERROR',
    message: first?.message ?? 'A business rule refused the write',
    ...(first?.field === undefined ? {} : { field: first.field }),
    ...(first === undefined ? {} : { rule: first.rule, errors }),
  }
}

/** The fields of one format violation a client may be told. */
const answeredFormatViolation = (entry: unknown): AnsweredFieldError | undefined => {
  if (entry === null || typeof entry !== 'object') return undefined
  const { field, message, index } = entry as Readonly<Record<string, unknown>>
  if (typeof field !== 'string' || typeof message !== 'string') return undefined
  return { field, message, ...(typeof index === 'number' ? { index } : {}) }
}

/**
 * The answer to a write one of whose values breaks its column's format
 * (`FieldFormatViolationError`, raised by the write orchestrations on every
 * road): `VALIDATION_ERROR`, the first violation's field and sentence at the
 * top, every violation in `errors` — the shape the records API's own format
 * check answers. The sentences name a column of the app's config, never the
 * value (S4). Answered 422 by the caller, which reads it off the tag.
 */
export function formatViolationAnswer(error: unknown): ValueRefusalAnswer {
  const { violations } = (error ?? {}) as { readonly violations?: unknown }
  const errors = (Array.isArray(violations) ? violations : []).flatMap((entry: unknown) => {
    const answered = answeredFormatViolation(entry)
    return answered === undefined ? [] : [answered]
  })
  const [first] = errors
  return {
    error: TITLES.VALIDATION_ERROR,
    code: 'VALIDATION_ERROR',
    message: first?.message ?? 'A value does not match its field format',
    ...(first?.field === undefined ? {} : { field: first.field }),
    ...(first === undefined ? {} : { errors }),
  }
}

/**
 * The refusals of the caller's VALUES a write orchestration raises, by tag,
 * whatever road the write came through: a table's business rule (the author's
 * message, every rule listed, 400) and a value breaking its column's format
 * (the records API's own 422 answer, carried as `status`).
 */
export const VALUE_REFUSAL_ANSWERS: Readonly<
  Record<string, (error: unknown) => ValueRefusalAnswer & { readonly status?: 422 }>
> = {
  BusinessRuleViolationError: businessRuleAnswer,
  FieldFormatViolationError: (error) => ({ ...formatViolationAnswer(error), status: 422 }),
}
