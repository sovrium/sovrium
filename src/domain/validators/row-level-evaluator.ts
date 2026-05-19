/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { normalizeCurrentUserRef } from '@/domain/utils/current-user-ref'
import type { RowLevelPredicate } from '@/domain/models/app/tables/permissions'

export interface CurrentUserContext {
  readonly userId: string
  readonly email: string | undefined
  readonly role: string
  readonly isUnrestricted: boolean
  readonly assignments: ReadonlyMap<string, readonly string[]>
  readonly activeAssignment?: string
}

export type ResolvedPredicateValue =
  | string
  | number
  | boolean
  | readonly string[]
  | readonly number[]
  | undefined

export const resolvePredicateValue = (
  value: RowLevelPredicate['value'],
  ctx: CurrentUserContext
): ResolvedPredicateValue => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value)
  ) {
    const ref = normalizeCurrentUserRef(value)
    if (!ref) return value as ResolvedPredicateValue
    return resolveRefScalar(ref, ctx)
  }

  if (typeof value === 'object' && value !== null && 'kind' in value) {
    const ref = normalizeCurrentUserRef(value)
    if (ref) return resolveRefScalar(ref, ctx)
  }

  return undefined
}

const resolveRefScalar = (
  ref: ReturnType<typeof normalizeCurrentUserRef> & { kind: 'currentUser' },
  ctx: CurrentUserContext
): ResolvedPredicateValue => {
  const { path } = ref
  if (path.kind === 'scalar') {
    if (path.name === 'id') return ctx.userId
    if (path.name === 'email') return ctx.email ?? ''
    if (path.name === 'role') return ctx.role
    return ctx.isUnrestricted
  }

  if (path.kind === 'assignment') {
    return ctx.assignments.get(path.tableSlug) ?? []
  }

  return ctx.activeAssignment ?? ''
}

export const mapRowLevelOperator = (
  operator: RowLevelPredicate['operator']
): 'equals' | 'notEquals' | 'in' | undefined => {
  if (operator === 'eq') return 'equals'
  if (operator === 'neq') return 'notEquals'
  if (operator === 'in') return 'in'
  return undefined
}

export const projectPredicateToFilter = (
  predicate: RowLevelPredicate,
  ctx: CurrentUserContext
):
  | {
      readonly field: string
      readonly operator: 'equals' | 'notEquals' | 'in'
      readonly value: unknown
    }
  | undefined => {
  const op = mapRowLevelOperator(predicate.operator)
  if (!op) return undefined

  const resolved = resolvePredicateValue(predicate.value, ctx)
  if (resolved === undefined) return undefined

  if (op === 'in') {
    const arr = Array.isArray(resolved) ? resolved : [resolved]
    return { field: predicate.field, operator: 'in', value: arr }
  }

  return { field: predicate.field, operator: op, value: resolved }
}

export const evaluateRecordAgainstPredicate = (
  record: Readonly<Record<string, unknown>>,
  predicate: RowLevelPredicate,
  ctx: CurrentUserContext
): boolean => {
  const resolved = resolvePredicateValue(predicate.value, ctx)
  if (resolved === undefined) return false

  const fieldValue = record[predicate.field]
  return compareValues(predicate.operator, fieldValue, resolved)
}

const compareValues = (
  operator: RowLevelPredicate['operator'],
  fieldValue: unknown,
  resolved: ResolvedPredicateValue
): boolean => {
  if (operator === 'eq') return scalarEquals(fieldValue, resolved)
  if (operator === 'neq') return !scalarEquals(fieldValue, resolved)
  if (operator === 'in') {
    const arr = Array.isArray(resolved) ? resolved : [resolved]
    return arr.some((candidate) => scalarEquals(fieldValue, candidate))
  }
  return false
}

const scalarEquals = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a === undefined || a === null || b === undefined || b === null) return false
  if (typeof a === typeof b) return false
  return String(a) === String(b)
}
