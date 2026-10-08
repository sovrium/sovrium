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

import { normalizeCurrentUserRef } from '@/domain/models/app/pages/current-user-ref'
import { chainLeafKey, isRowRuleChain, parseRowRuleChain } from './row-rule-chain-service'
import type {
  RowLevelPermissions,
  RowLevelPredicate,
  RowLevelPredicateGroup,
  RowLevelWhen,
} from '@/domain/models/app/tables/permissions'

/**
 * Type guard distinguishing a composite predicate GROUP from a single
 * `field/operator/value` triple. A group is identified by the presence of a
 * `conditions` array; a triple has a `field` key.
 */
export const isPredicateGroup = (when: RowLevelWhen): when is RowLevelPredicateGroup =>
  typeof when === 'object' &&
  when !== null &&
  'conditions' in when &&
  Array.isArray((when as RowLevelPredicateGroup).conditions)

/**
 * `true` when a row-level `when` names the signed-in person anywhere — a
 * `$currentUser.<path>` value, in either its string or its object form, in a
 * leaf or in any branch of a group, at any depth.
 *
 * SECURITY: this decides whether a rule can be evaluated for a reader with NO
 * session. A rule that names nobody (`status eq published`) applies to them as
 * to anyone; a rule that names the signed-in person must refuse them outright,
 * because evaluating it against an empty identity would compare the row with
 * blanks. The walk reads the parsed rule, never its text, so the answer is
 * exactly the set of values {@link resolvePredicateValue} would substitute: a
 * leaf's `value` is the only place a reference is resolved, and a `$currentUser`
 * string inside a literal ARRAY is compared as that literal, never resolved.
 */
export const rowRuleNamesCurrentUser = (when: RowLevelWhen): boolean =>
  isPredicateGroup(when)
    ? when.conditions.some(rowRuleNamesCurrentUser)
    : normalizeCurrentUserRef(when.value) !== undefined

/** A scalar `$currentUser.<name>` a rule can read about the signed-in person. */
export type CurrentUserScalar = 'id' | 'email' | 'role' | 'isUnrestricted'

/**
 * `true` when a row-level `when` reads `$currentUser.<name>` anywhere — in
 * either spelling, in a leaf or in any branch of a group.
 *
 * It decides which facts about the reader a door must look up before it can
 * judge the rule: a rule that never names the reader's email does not need it,
 * so nothing is read for it.
 */
export const ruleNamesCurrentUser = (when: RowLevelWhen, name: CurrentUserScalar): boolean => {
  if (isPredicateGroup(when)) {
    return when.conditions.some((child) => ruleNamesCurrentUser(child, name))
  }
  const ref = normalizeCurrentUserRef(when.value)
  return ref?.path.kind === 'scalar' && ref.path.name === name
}

/**
 * `true` when ANY of a table's row-level rules — read, write, create or delete
 * — reads `$currentUser.<name>`.
 */
export const rulesNameCurrentUser = (
  rlp: RowLevelPermissions | undefined,
  name: CurrentUserScalar
): boolean =>
  [rlp?.read?.when, rlp?.write?.when, rlp?.create?.when, rlp?.delete?.when].some(
    (when) => when !== undefined && ruleNamesCurrentUser(when, name)
  )

export interface CurrentUserContext {
  readonly userId: string
  readonly email: string | undefined
  readonly role: string
  readonly isUnrestricted: boolean
  /** Map of scopeTable → flattened record-id list from user_access rows. */
  readonly assignments: ReadonlyMap<string, readonly string[]>
  /** Most recent active-assignment record id (from cookie / session). */
  readonly activeAssignment?: string
  /**
   * A visitor with no session. Nothing about her resolves: every
   * `$currentUser.*` value is unknown, and a rule naming one admits no row —
   * see {@link signedOutContext}.
   */
  readonly signedOut?: boolean
  /**
   * For each `<relationship>.<column>` leaf of the rules (`chainLeafKey`): the
   * ids of the related rows the leaf admits, looked up once for this reader. A
   * chain leaf with no entry admits no row — see `row-rule-chain-service.ts`.
   */
  readonly chainMatches?: ReadonlyMap<string, readonly unknown[]>
}

/**
 * The context of a visitor with no session, as every door judges her.
 *
 * SECURITY: the records API carries a placeholder identity for such a request
 * (`guest`, as her id and as her role). Those are labels, not a person: read as
 * values, a rule `audience eq $currentUser.role` served her every row whose
 * audience was the word `guest`, and `owner neq $currentUser.id` served her
 * every row somebody owns. So none of her `$currentUser.*` values resolves,
 * and a rule that names the signed-in person ANYWHERE — even in one branch of
 * an `or` — admits no row for her, in memory and in SQL alike: exactly the
 * record gate's answer for a reader who is not signed in
 * (`visitorRowRule` → `none`). A rule naming no one (`status eq published`)
 * still applies to her as written.
 */
export const signedOutContext = (userId: string, role: string): CurrentUserContext => ({
  userId,
  email: undefined,
  role,
  isUnrestricted: false,
  assignments: new Map(),
  signedOut: true,
})

/** A signed-out visitor under a rule that names the signed-in person: no row is hers. */
const refusesSignedOut = (when: RowLevelWhen, ctx: CurrentUserContext): boolean =>
  ctx.signedOut === true && rowRuleNamesCurrentUser(when)

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
 * Unrecognized references collapse to `undefined`, and so does a reference
 * to a value the reader does not have (no email, no active assignment): a
 * rule naming it matches no row.
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

/**
 * A value the reader does not have — no email on record, no active
 * assignment — as `undefined`, never as the empty string.
 *
 * SECURITY: an empty string is a value a row can hold. Read as `''`, a missing
 * email matched every row whose ruled field is empty, in memory and in SQL
 * alike, and a reader whose email was simply not loaded was refused her own
 * rows while being served everybody's blank ones. `undefined` resolves to "no
 * row matches" on both sides: {@link evaluateTriple} answers `false`, and
 * {@link projectPredicateToFilter} answers nothing to project.
 */
const knownValue = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value

const resolveRefScalar = (
  ref: ReturnType<typeof normalizeCurrentUserRef> & { kind: 'currentUser' },
  ctx: CurrentUserContext
): ResolvedPredicateValue => {
  const { path } = ref
  if (ctx.signedOut === true) return undefined
  if (path.kind === 'scalar') {
    if (path.name === 'id') return knownValue(ctx.userId)
    if (path.name === 'email') return knownValue(ctx.email)
    if (path.name === 'role') return knownValue(ctx.role)
    return ctx.isUnrestricted
  }

  if (path.kind === 'assignment') {
    return ctx.assignments.get(path.tableSlug) ?? []
  }

  // activeAssignment
  return knownValue(ctx.activeAssignment)
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
  if (isRowRuleChain(predicate.field)) return projectChainLeaf(predicate, ctx)

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
// [internal ref]: composite predicate projection (nestable AND/OR filter tree)
// ---------------------------------------------------------------------------

/** A single SQL filter leaf clause projected from a predicate triple. */
export interface RowLevelLeafClause {
  readonly field: string
  readonly operator: 'equals' | 'notEquals' | 'in'
  readonly value: unknown
}

/**
 * Nestable filter node projected from a row-level `when` predicate.
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
 * into a nestable filter tree the SQL WHERE builder can render.
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
  if (refusesSignedOut(when, ctx)) return MATCH_NOTHING_LEAF
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
 * A chain leaf as the SQL list asks it: the row's relationship is one of the
 * related rows the leaf admits. `undefined` (no row visible) when the chain
 * cannot be followed or was not looked up for this reader.
 */
const projectChainLeaf = (
  predicate: RowLevelPredicate,
  ctx: CurrentUserContext
): RowLevelLeafClause | undefined => {
  const chain = parseRowRuleChain(predicate.field)
  const ids = ctx.chainMatches?.get(chainLeafKey(predicate))
  if (chain === undefined || ids === undefined) return undefined
  return { field: chain.relation, operator: 'in', value: ids }
}

/** A chain leaf against one record: its relationship points at an admitted related row. */
const evaluateChainLeaf = (
  record: Readonly<Record<string, unknown>>,
  predicate: RowLevelPredicate,
  ctx: CurrentUserContext
): boolean => {
  const clause = projectChainLeaf(predicate, ctx)
  if (clause === undefined) return false
  return compareValues('in', record[clause.field], clause.value as ResolvedPredicateValue)
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
  if (isRowRuleChain(predicate.field)) return evaluateChainLeaf(record, predicate, ctx)
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
 * Handles both forms:
 *  - single triple: the record's `field` value is compared against the
 *    resolved predicate value using the operator semantics. An empty value
 *    (`null`) or a field the record does not have (`undefined`) satisfies no
 *    operator — not `eq`, not `in`, and not `neq` either — as the records list
 *    answers the same rule in SQL, where `NULL <> 'draft'` is not true.
 *  - composite group: recurses over `conditions`, combining with `every`
 *    (logic `'and'`, the default) or `some` (logic `'or'`).
 */
export const evaluateRecordAgainstPredicate = (
  record: Readonly<Record<string, unknown>>,
  predicate: RowLevelWhen,
  ctx: CurrentUserContext
): boolean => {
  if (refusesSignedOut(predicate, ctx)) return false
  if (isPredicateGroup(predicate)) {
    const evaluateChild = (child: RowLevelWhen): boolean =>
      evaluateRecordAgainstPredicate(record, child, ctx)
    return predicate.logic === 'or'
      ? predicate.conditions.some(evaluateChild)
      : predicate.conditions.every(evaluateChild)
  }
  return evaluateTriple(record, predicate, ctx)
}

/**
 * `fieldValue` (the stored value) satisfies `operator` against `resolved`.
 *
 * SECURITY: an empty stored value satisfies nothing, `neq` included. The list
 * answers the rule in SQL, where a NULL compares as unknown and the row is
 * dropped; a single-record door that admitted it would reach a row the list
 * hides.
 */
const compareValues = (
  operator: RowLevelPredicate['operator'],
  fieldValue: unknown,
  resolved: ResolvedPredicateValue
): boolean => {
  if (fieldValue === undefined || fieldValue === null) return false
  if (operator === 'eq') return scalarEquals(fieldValue, resolved)
  if (operator === 'neq') return !scalarEquals(fieldValue, resolved)
  if (operator === 'in') {
    const arr = Array.isArray(resolved) ? resolved : [resolved]
    return arr.some((candidate) => scalarEquals(fieldValue, candidate))
  }
  return false
}

/**
 * The number a rule value written as text names (`'12.50'` → `12.5`), or
 * `undefined` for text that is not a number.
 */
const numberWrittenAsText = (value: string): number | undefined => {
  if (value.trim() === '') return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

/**
 * `a` (the stored value, read by `readStoredValues`) equals `b` (the rule's).
 *
 * A stored number is compared as a number, as the database compares it when
 * the list answers the rule in SQL: `12.5` equals a rule value written
 * `'12.50'`. Any other pair of different types is compared by its text, so a
 * numeric id equals the same id written as text.
 */
const scalarEquals = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a === undefined || a === null || b === undefined || b === null) return false
  if (typeof a === typeof b) return false
  if (typeof a === 'number' && typeof b === 'string') return numberWrittenAsText(b) === a
  return String(a) === String(b)
}
