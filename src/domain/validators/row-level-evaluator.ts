/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Z-3 row-level permission predicate evaluator (pure functions).
 *
 * `tablePermissions.rowLevelPermissions.{read,write,create,delete}.when` is
 * a `field/operator/value` triple that filters records server-side at the
 * API layer. The evaluator runs in two modes:
 *
 * 1. **Filter projection** — convert the predicate into the `QueryFilter`
 *    shape the table repository understands, so list queries are filtered
 *    at the SQL layer (no over-fetching).
 *
 * 2. **Per-record evaluation** — given a fetched record (or a candidate
 *    new record on create), check whether the predicate is satisfied. Used
 *    for direct GETs, PATCH/DELETE pre-checks, and create.when validation.
 *
 * The predicate `value` may be either a literal (string/number/array) or a
 * `$currentUser.<path>` reference (typed object form OR string-template
 * sugar). Literal values pass through unchanged; reference values are
 * resolved via the `CurrentUserContext` parameter (whose `assignments`
 * map is pre-fetched by the caller from the `user_access` junction).
 *
 * Operators supported here mirror `RowLevelFilterOperatorSchema`:
 *   - `eq`  / `neq` — scalar comparison
 *   - `in`          — array membership (value MUST resolve to an array)
 *
 * These are mapped to the table repository's filter operators:
 *   - `eq`  → `equals`
 *   - `neq` → `notEquals`
 *   - `in`  → `in`
 */

import { normalizeCurrentUserRef } from '@/domain/utils/current-user-ref'
import type {
  RowLevelPredicate,
  RowLevelPredicateGroup,
  RowLevelWhen,
} from '@/domain/models/app/tables/permissions'

/**
 * Type guard distinguishing a composite predicate GROUP (GAP-3) from a single
 * `field/operator/value` triple. A group is identified by the presence of a
 * `conditions` array; a triple has a `field` key.
 */
export const isPredicateGroup = (when: RowLevelWhen): when is RowLevelPredicateGroup =>
  typeof when === 'object' &&
  when !== null &&
  'conditions' in when &&
  Array.isArray((when as RowLevelPredicateGroup).conditions)

export interface CurrentUserContext {
  readonly userId: string
  readonly email: string | undefined
  readonly role: string
  readonly isUnrestricted: boolean
  /** Map of scopeTable → flattened record-id list from user_access rows. */
  readonly assignments: ReadonlyMap<string, readonly string[]>
  /** Most recent active-assignment record id (from cookie / session). */
  readonly activeAssignment?: string
}

/**
 * Resolved value of a predicate's `value` field after `$currentUser`
 * substitution. May be `undefined` when an unknown reference is used; the
 * caller treats `undefined` as "no records match" for safety.
 */
export type ResolvedPredicateValue =
  string | number | boolean | readonly string[] | readonly number[] | undefined

/**
 * Resolve a predicate's `value` field. Literal values pass through; a
 * `$currentUser.<path>` reference is replaced with the corresponding
 * value from `ctx`.
 *
 * Behaviour:
 *  - `id`, `email`, `role`, `isUnrestricted` → scalar from session
 *  - `assignments.<tableSlug>`                → readonly string[] (flattened
 *    record_ids); empty array if the user has no rows for that scope
 *  - `activeAssignment`                       → string (from session/cookie)
 *
 * Unrecognized references collapse to `undefined`.
 */
export const resolvePredicateValue = (
  value: RowLevelPredicate['value'],
  ctx: CurrentUserContext
): ResolvedPredicateValue => {
  // Literal pass-through (string, number, boolean, array)
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

  // Typed currentUser ref (object form)
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

  // activeAssignment
  return ctx.activeAssignment ?? ''
}

/**
 * Map a row-level operator to the table repository's filter operator.
 *
 * Returns `undefined` for unsupported operators so the caller can
 * conservatively reject the request rather than silently widening access.
 */
export const mapRowLevelOperator = (
  operator: RowLevelPredicate['operator']
): 'equals' | 'notEquals' | 'in' | undefined => {
  if (operator === 'eq') return 'equals'
  if (operator === 'neq') return 'notEquals'
  if (operator === 'in') return 'in'
  return undefined
}

/**
 * Project a row-level predicate into a single `QueryFilter` clause that
 * the table repository can append (AND) to its WHERE clause.
 *
 * Returns `undefined` when the predicate cannot be safely projected (e.g.
 * unknown operator, unresolved reference). Callers should treat this as
 * "no records visible" — i.e., return an empty list — to avoid leaking
 * unscoped data.
 */
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

  // For `in`, value must be an array; coerce singletons rather than fail
  // the request, but keep an empty array as-is (the SQL layer turns
  // `IN ()` into a no-match clause via its own dedicated path).
  if (op === 'in') {
    const arr = Array.isArray(resolved) ? resolved : [resolved]
    return { field: predicate.field, operator: 'in', value: arr }
  }

  return { field: predicate.field, operator: op, value: resolved }
}

// ---------------------------------------------------------------------------
// GAP-3: composite predicate projection (nestable AND/OR filter tree)
// ---------------------------------------------------------------------------

/** A single SQL filter leaf clause projected from a predicate triple. */
export interface RowLevelLeafClause {
  readonly field: string
  readonly operator: 'equals' | 'notEquals' | 'in'
  readonly value: unknown
}

/**
 * Nestable filter node projected from a row-level `when` predicate (GAP-3).
 * A leaf is a single clause; `and`/`or` nodes compose children. The SQL WHERE
 * builder walks this tree, emitting `( … AND … )` / `( … OR … )` groups.
 */
export type RowLevelFilterNode =
  | RowLevelLeafClause
  | { readonly and: readonly RowLevelFilterNode[] }
  | { readonly or: readonly RowLevelFilterNode[] }

/**
 * A leaf that matches NO rows. Used when a sub-predicate cannot be projected
 * (unknown operator / unresolved reference) inside a composite group: an
 * unmatchable branch must NOT collapse the whole predicate, only that branch.
 * Rendered by the SQL layer as `id IN (NULL)` (an empty `in` → matches none).
 */
const MATCH_NOTHING_LEAF: RowLevelLeafClause = {
  field: 'id',
  operator: 'in',
  value: [] as readonly string[],
}

/**
 * Project a row-level `when` predicate (single triple OR composite group)
 * into a nestable filter tree the SQL WHERE builder can render (GAP-3).
 *
 * Returns:
 *  - a {@link RowLevelFilterNode} tree on success
 *  - `undefined` when a TOP-LEVEL single triple cannot be projected (unknown
 *    operator / unresolved reference) — callers treat this as "no records
 *    visible" exactly as the legacy `projectPredicateToFilter` contract.
 *
 * Inside a composite group an un-projectable leaf becomes a match-nothing
 * branch (NOT a whole-predicate failure) so an `or` group stays satisfiable
 * via its other branches — and an empty `in` is scoped to its own branch.
 */
export const projectWhenToFilter = (
  when: RowLevelWhen,
  ctx: CurrentUserContext
): RowLevelFilterNode | undefined => {
  if (!isPredicateGroup(when)) {
    return projectPredicateToFilter(when, ctx)
  }
  const children = when.conditions.map((child) =>
    isPredicateGroup(child)
      ? (projectWhenToFilter(child, ctx) ?? MATCH_NOTHING_LEAF)
      : (projectPredicateToFilter(child, ctx) ?? MATCH_NOTHING_LEAF)
  )
  return when.logic === 'or' ? { or: children } : { and: children }
}

/**
 * Evaluate a single `field/operator/value` triple against a record (base
 * case of {@link evaluateRecordAgainstPredicate}).
 */
const evaluateTriple = (
  record: Readonly<Record<string, unknown>>,
  predicate: RowLevelPredicate,
  ctx: CurrentUserContext
): boolean => {
  const resolved = resolvePredicateValue(predicate.value, ctx)
  if (resolved === undefined) return false

  const fieldValue = record[predicate.field]
  return compareValues(predicate.operator, fieldValue, resolved)
}

/**
 * Evaluate a record against a row-level `when` predicate. Used for:
 *  - direct GET-by-id (404 if false)
 *  - PATCH / DELETE pre-checks (404 if false)
 *  - create.when validation (403 if false — scope leaks at insert time)
 *
 * Handles both forms (GAP-3):
 *  - single triple: the record's `field` value is compared against the
 *    resolved predicate value using the operator semantics. Missing fields
 *    evaluate to `undefined`, which fails `eq`/`in` (safer than silently
 *    allowing).
 *  - composite group: recurses over `conditions`, combining with `every`
 *    (logic `'and'`, the default) or `some` (logic `'or'`).
 */
export const evaluateRecordAgainstPredicate = (
  record: Readonly<Record<string, unknown>>,
  predicate: RowLevelWhen,
  ctx: CurrentUserContext
): boolean => {
  if (isPredicateGroup(predicate)) {
    const evaluateChild = (child: RowLevelWhen): boolean =>
      evaluateRecordAgainstPredicate(record, child, ctx)
    return predicate.logic === 'or'
      ? predicate.conditions.some(evaluateChild)
      : predicate.conditions.every(evaluateChild)
  }
  return evaluateTriple(record, predicate, ctx)
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
  // Loose-but-typed: coerce numeric-vs-string ids ('c1' vs 'c1' is fine, but
  // 1 vs '1' should match given UUIDs / TEXT mixed with numeric pks).
  if (a === undefined || a === null || b === undefined || b === null) return false
  if (typeof a === typeof b) return false
  return String(a) === String(b)
}
