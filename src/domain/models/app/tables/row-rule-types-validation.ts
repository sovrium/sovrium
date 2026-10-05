/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A row rule that cannot match its field's stored type is refused before the
 * app starts.
 *
 * The records list answers a row rule in SQL and every other door answers it
 * against the row it fetched; both read a stored value by its field's type
 * (`readStoredValues`). A rule written in a shape that type cannot hold has no
 * answer both agree on, so `sovrium validate` and the boot refuse it, saying
 * what to write instead:
 *
 *  - a rule on a `multi-select` field — the field stores a list of options, a
 *    rule compares one value;
 *  - a number field compared with anything but a number (`'12.50'` → `12.5`);
 *  - a `date` field compared with anything but `YYYY-MM-DD`;
 *  - a date-and-time field compared with anything but the UTC instant the
 *    write path stores (`2026-10-01T09:30:00.000Z`);
 *  - a checkbox compared with anything but `true` or `false`.
 *
 * A rule naming `$currentUser.activeAssignment` is refused on any field: no
 * row rule resolves the active scope, so it could never match a record — the
 * rule is scoped with `$currentUser.assignments.<table>` instead. Any other
 * `$currentUser` value is resolved per request and always valid, and a field
 * the table does not declare (`id`, a relation chain) is left to the rule.
 */

import { normalizeCurrentUserRef } from '@/domain/models/app/pages/current-user-ref'
import { isPredicateGroup } from './row-level-evaluator-service'
import { DATE_FIELD_TYPES, DATETIME_FIELD_TYPES, NUMBER_FIELD_TYPES } from './stored-value-service'
import type { RowLevelPredicate, RowLevelWhen } from './row-level-permissions'

interface RuleField {
  readonly name: string
  readonly type: string
}

interface RuleError {
  readonly message: string
  readonly path: ReadonlyArray<string>
}

type RuleOperation = 'read' | 'write' | 'create' | 'delete'

const OPERATIONS: readonly RuleOperation[] = ['read', 'write', 'create', 'delete']

const BOOLEAN_FIELD_TYPES: ReadonlySet<string> = new Set(['checkbox', 'boolean', 'bool'])

/** A value as the config spells it, quoted when it is text. */
const spelled = (value: unknown): string =>
  typeof value === 'string' ? `"${value}"` : JSON.stringify(value)

/** What to write instead of `value` on a number field, or `undefined` when it is a number. */
const numberAdvice = (value: unknown): string | undefined => {
  if (typeof value === 'number') return undefined
  const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(numeric) ? `write ${numeric} as a number` : 'write a number'
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/
const EXPLICIT_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i

/** The instant an ISO date-time names, a value with no zone read as UTC. */
const instantOf = (value: string): Readonly<Date> | undefined => {
  if (!ISO_DATE_TIME.test(value)) return undefined
  const date = new Date(EXPLICIT_ZONE.test(value) ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** A real calendar day written `YYYY-MM-DD`. */
const isDay = (value: string): boolean =>
  ISO_DAY.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value)

/** What to write instead of `value` on a date field, or `undefined` when it is a day. */
const dateAdvice = (value: unknown): string | undefined => {
  if (typeof value === 'string' && isDay(value)) return undefined
  const instant = typeof value === 'string' ? instantOf(value) : undefined
  const example = instant?.toISOString().slice(0, 10) ?? '2026-10-01'
  return `write the date as YYYY-MM-DD, e.g. ${example}`
}

/** What to write instead of `value` on a date-and-time field, or `undefined` when it is the stored instant. */
const datetimeAdvice = (value: unknown): string | undefined => {
  const instant = typeof value === 'string' ? instantOf(value) : undefined
  if (instant !== undefined && instant.toISOString() === value) return undefined
  return instant === undefined
    ? 'write the UTC instant as stored, e.g. 2026-10-01T09:30:00.000Z'
    : `write the UTC instant as stored: ${instant.toISOString()}`
}

/** What to write instead of `value` on a checkbox, or `undefined` when it is a boolean. */
const booleanAdvice = (value: unknown): string | undefined => {
  if (typeof value === 'boolean') return undefined
  const text = typeof value === 'string' ? value.trim().toLowerCase() : undefined
  return text === 'true' || text === 'false' ? `write ${text} as a boolean` : 'write true or false'
}

/** The advice for one literal compared with a field of `type`, or `undefined` when it can match. */
const adviceFor = (type: string, value: unknown): string | undefined => {
  if (NUMBER_FIELD_TYPES.has(type)) return numberAdvice(value)
  if (DATE_FIELD_TYPES.has(type)) return dateAdvice(value)
  if (DATETIME_FIELD_TYPES.has(type)) return datetimeAdvice(value)
  if (BOOLEAN_FIELD_TYPES.has(type)) return booleanAdvice(value)
  return undefined
}

/** The refusal of one rule triple, or `undefined` when it can match its field. */
const tripleError = (
  predicate: RowLevelPredicate,
  fields: ReadonlyMap<string, string>,
  operation: RuleOperation
): RuleError | undefined => {
  const path = ['rowLevelPermissions', operation, 'when']
  if (normalizeCurrentUserRef(predicate.value)?.path.kind === 'activeAssignment') {
    return {
      message: `row rule on "${predicate.field}" names $currentUser.activeAssignment, which no row rule resolves — use $currentUser.assignments.<table> to scope the rule to the records the person is assigned to`,
      path,
    }
  }
  const type = fields.get(predicate.field)
  if (type === undefined) return undefined
  if (type === 'multi-select') {
    return {
      message: `row rule on "${predicate.field}" cannot match: "${predicate.field}" is a multi-select field, which stores a list of options while a row rule compares one value — rule on a single-select, text or checkbox field instead`,
      path,
    }
  }
  if (normalizeCurrentUserRef(predicate.value) !== undefined) return undefined
  const values: readonly unknown[] = Array.isArray(predicate.value)
    ? predicate.value
    : [predicate.value]
  const advised = values
    .map((value) => ({ value, advice: adviceFor(type, value) }))
    .find((entry) => entry.advice !== undefined)
  if (advised === undefined) return undefined
  return {
    message: `row rule on "${predicate.field}" compares a ${type} field with ${spelled(advised.value)}, which it never stores: ${advised.advice ?? ''}`,
    path,
  }
}

/** The first refusal in a `when`, walking every condition of a group. */
const whenError = (
  when: RowLevelWhen,
  fields: ReadonlyMap<string, string>,
  operation: RuleOperation
): RuleError | undefined => {
  if (!isPredicateGroup(when)) return tripleError(when, fields, operation)
  return when.conditions.reduce<RuleError | undefined>(
    (found, child) => found ?? whenError(child, fields, operation),
    undefined
  )
}

/**
 * The first row rule of a table that cannot match its field's stored type,
 * with what to write instead; `undefined` when every rule can match.
 */
export const validateRowRuleTypes = (
  rowLevelPermissions:
    | Readonly<Partial<Record<RuleOperation, { readonly when: RowLevelWhen } | undefined>>>
    | undefined,
  fields: ReadonlyArray<RuleField>
): RuleError | undefined => {
  if (rowLevelPermissions === undefined) return undefined
  const types = new Map(fields.map((field) => [field.name, field.type]))
  return OPERATIONS.reduce<RuleError | undefined>((found, operation) => {
    if (found !== undefined) return found
    const when = rowLevelPermissions[operation]?.when
    return when === undefined ? undefined : whenError(when, types, operation)
  }, undefined)
}
