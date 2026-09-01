/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { UnknownFilterFieldError } from '@/domain/errors'
import { isResolvableColumnName } from '@/domain/models/shared/system-fields'
import { buildGuestSession } from '../build-guest-session'
import type { ActionOutcome } from './shared'
import type {
  QueryFilter,
  QueryFilterNode,
} from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'

/**
 * Filter compilation shared by every record action that targets rows by
 * condition rather than by primary key.
 *
 * Extracted verbatim from `record.ts` when the batch operators
 * (`record-batch.ts`) became a second consumer: `batchUpdate` resolves one
 * filter per item and `batchDelete` resolves one for the whole operation, using
 * exactly the same `{ conditions: [...] }` → `QueryFilter` translation and the
 * same `id equals` fast path as `record/update` and `record/delete`. Two copies
 * of a filter compiler is how the single-record and batch operators come to
 * disagree about what `equals` means; one module is the fix.
 *
 * Pure move — no behaviour change.
 */

interface FilterCondition {
  readonly field?: string
  readonly operator?: string
  readonly value?: unknown
}

interface FilterGroup {
  readonly conditions?: readonly FilterCondition[]
}

const isValidIdEqualsCondition = (condition: FilterCondition): boolean => {
  if (condition.field !== 'id') return false
  if (condition.operator !== 'equals') return false
  if (condition.value === undefined) return false
  if (condition.value === '') return false
  return true
}

/**
 * Extract a single record id from the foundational filter shape:
 * `{ conditions: [{ field: 'id', operator: 'equals', value: <id> }] }`.
 *
 * Returns undefined if the filter is missing, has multiple conditions, or does
 * not match the `id equals` shape — callers then fall back to
 * {@link resolveIdsByFilter}, which handles any ConditionGroup. The fast path
 * exists so single-record writes (the record-event trigger's "update the row
 * that just changed") skip the list query.
 */
export const extractIdFromFilter = (filter: unknown): string | undefined => {
  if (!filter || typeof filter !== 'object') return undefined
  const { conditions } = filter as FilterGroup
  if (!Array.isArray(conditions) || conditions.length !== 1) return undefined
  const condition = conditions[0]
  if (!condition || typeof condition !== 'object') return undefined
  if (!isValidIdEqualsCondition(condition)) return undefined
  return String(condition.value)
}

/**
 * Translate the spec's filter shape (`{ conditions: [{ field, operator,
 * value }] }`) into the repository's `QueryFilter` (`{ and: [...] }`). The two
 * shapes carry the same information; the rename exists because the spec mirrors
 * the records-API public contract while `QueryFilter` is the internal
 * repository protocol.
 *
 * Returns undefined for a filter that compiles to zero usable conditions.
 * Callers MUST treat that as a refusal, never as "match everything" — an
 * all-matching filter on a delete is a mass-deletion.
 */
export const toQueryFilter = (filter: unknown): QueryFilter | undefined => {
  if (!filter || typeof filter !== 'object') return undefined
  const { conditions } = filter as FilterGroup
  if (!Array.isArray(conditions) || conditions.length === 0) return undefined
  const and = conditions.flatMap((c) => {
    if (!c || typeof c !== 'object') return []
    const { field, operator, value } = c as FilterCondition
    if (typeof field !== 'string' || typeof operator !== 'string') return []
    return [{ field, operator, value }] as const
  })
  return and.length > 0 ? { and } : undefined
}

/**
 * The author-declared field names of `tableName`, or undefined when the config
 * declares no such table.
 *
 * Undefined means "cannot adjudicate", NOT "everything is allowed": the only
 * way to reach it is a record action whose `table` prop is itself a `{{...}}`
 * template, since the AppSchema table rule already refuses a literal unknown
 * table at boot. Such an action would fail at the query anyway (no such
 * relation, on both engines), so declining to judge its fields preserves the
 * pre-existing behaviour rather than inventing a second verdict for it.
 */
export const declaredFieldNames = (
  app: {
    readonly tables?: readonly {
      readonly name: string
      readonly fields: readonly { readonly name: string }[]
    }[]
  },
  tableName: string
): ReadonlySet<string> | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  return table ? new Set(table.fields.map((f) => f.name)) : undefined
}

/** Every field name a compiled filter tree would turn into a SQL identifier. */
const filterFieldRefs = (node: QueryFilterNode): readonly string[] => {
  if ('field' in node && typeof node.field === 'string') return [node.field]
  if ('and' in node && Array.isArray(node.and)) return node.and.flatMap(filterFieldRefs)
  if ('or' in node && Array.isArray(node.or)) return node.or.flatMap(filterFieldRefs)
  return []
}

/**
 * The first field of `queryFilter` that resolves to no column of the table, or
 * undefined when every one of them does.
 *
 * This is the RUNTIME half of the record-filter field check. Its boot-time
 * sibling (the AppSchema cross-validation) cannot cover a field that arrives
 * through a `{{...}}` template — `resolveTriggerInValue` rewrites every string
 * leaf of an action's props, so `batchUpdate`'s per-item filters, and any
 * `field: '{{trigger.data.column}}'`, are only knowable once a request lands.
 *
 * The check is deliberately made HERE rather than left to the database,
 * because the engines disagree about an unknown identifier in the worst
 * possible direction. Postgres raises 42703 during parse analysis and the
 * lookup fails closed. SQLite — the zero-config DEFAULT engine — resolves a
 * double-quoted name matching no column to a string LITERAL, so `"knid" <>
 * 'archived'` compares the constant 'knid' against 'archived' on every row and
 * the predicate matches the WHOLE table. Whether it degrades turns on the
 * OPERAND, not the operator (`contains 'ni'` against the name 'knid' is a
 * tautology too), so no subset of operators is safe to exempt and no
 * engine-raised error can be relied on.
 */
const unresolvableFilterField = (
  queryFilter: QueryFilter,
  declaredFields: ReadonlySet<string>
): string | undefined =>
  (queryFilter.and ?? [])
    .flatMap(filterFieldRefs)
    .find((field) => !isResolvableColumnName(declaredFields, field))

/**
 * The refusal a compiled filter earns, or undefined when every field resolves.
 *
 * The message names the available columns for the same reason the boot-time
 * sibling does: the operator's next question after "that field is wrong" is
 * always "then what is the right one?", and an automation run failure is read
 * from run history rather than from a console with the schema in front of it.
 *
 * Exported for `record/read` alone. Every other condition-based operator reaches
 * this through {@link resolveActionTargetIds}, which resolves row IDS — but a
 * read returns the ROWS, so routing it through the id resolver would mean a
 * second query per row and would silently inherit the LENIENT policy, degrading
 * a repository failure into "no rows". `record/read` propagates that failure
 * today and must keep doing so, so it applies the same refusal to its own
 * `listRecords` call rather than borrowing a lookup it does not want.
 */
export const filterFieldRefusal = (
  tableName: string,
  queryFilter: QueryFilter,
  declaredFields: ReadonlySet<string> | undefined
): Readonly<UnknownFilterFieldError> | undefined => {
  if (declaredFields === undefined) return undefined
  const unresolvable = unresolvableFilterField(queryFilter, declaredFields)
  if (unresolvable === undefined) return undefined
  return new UnknownFilterFieldError(
    `filter references field '${unresolvable}', which does not exist in table '${tableName}'. ` +
      `Available: ${[...declaredFields].join(', ')}`,
    unresolvable
  )
}

/**
 * The refusal a `record/list` sort earns, or undefined when every key names a
 * resolvable column.
 *
 * The sibling of {@link filterFieldRefusal}, deliberately built on the SAME
 * {@link isResolvableColumnName} predicate rather than on a second opinion of
 * its own. The invariant the boot-time half in `app/index.ts` states is that
 * the config-time and run-time verdicts on one name can never disagree, and a
 * second predicate is precisely how they would come to.
 *
 * A sort field is a WORSE surface than a filter field, not a milder one. A
 * filter naming no column at least returns a visibly wrong row SET; an unknown
 * sort key returns the RIGHT rows in an arbitrary order, with a successful run
 * and nothing anywhere saying the ordering never happened. `validateColumnName`
 * downstream checks shape alone — `knid` satisfies `/^[a-z_][a-z0-9_]*$/i` — so
 * `buildSortClause` emits `"knid" ASC`, and on SQLite an unknown double-quoted
 * name degrades to a string LITERAL: every row sorts by the same constant.
 * Paired with a `limit` that hands the caller an arbitrary page.
 *
 * Refusing here, before any SQL is built, also forecloses `,` and `:` reaching
 * the port's `field:direction,field:direction` encoding and corrupting it —
 * neither character can appear in a resolvable column name. That is a side
 * effect of the check rather than its purpose, which is why the E2E criterion
 * asserts the refusal directly instead of relying on it.
 *
 * `declaredFields === undefined` means "cannot adjudicate", NOT "everything is
 * allowed" — see {@link declaredFieldNames}.
 */
export const sortFieldRefusal = (
  tableName: string,
  sortFields: readonly string[],
  declaredFields: ReadonlySet<string> | undefined
): Readonly<UnknownFilterFieldError> | undefined => {
  if (declaredFields === undefined) return undefined
  const unresolvable = sortFields.find((field) => !isResolvableColumnName(declaredFields, field))
  if (unresolvable === undefined) return undefined
  return new UnknownFilterFieldError(
    `sort references field '${unresolvable}', which does not exist in table '${tableName}'. ` +
      `Available: ${[...declaredFields].join(', ')}`,
    unresolvable
  )
}

/**
 * The refusal a `record/list` field selection earns, or undefined when every
 * name in it resolves.
 *
 * The third sibling of {@link filterFieldRefusal} and {@link sortFieldRefusal},
 * built on the same {@link isResolvableColumnName} predicate for the same
 * reason: the boot-time and run-time halves must not be able to reach opposite
 * verdicts about one name.
 *
 * This surface degrades more QUIETLY than either of the others, which is why it
 * is worth refusing rather than tolerating. A `fields` entry naming no column
 * never becomes a SQL identifier on this path — an automation trim is a key
 * lookup over rows already fetched — so nothing raises anywhere. The action
 * simply returns rows without that key, every downstream `{{…records.0.tittle}}`
 * expands to nothing, and the run reports success. A typo in a payload trim
 * should not be harder to notice than a typo in a sort.
 *
 * `declaredFields === undefined` means "cannot adjudicate", NOT "everything is
 * allowed" — see {@link declaredFieldNames}.
 */
export const selectionFieldRefusal = (
  tableName: string,
  selectedFields: readonly string[],
  declaredFields: ReadonlySet<string> | undefined
): Readonly<UnknownFilterFieldError> | undefined => {
  if (declaredFields === undefined) return undefined
  const unresolvable = selectedFields.find(
    (field) => !isResolvableColumnName(declaredFields, field)
  )
  if (unresolvable === undefined) return undefined
  return new UnknownFilterFieldError(
    `fields references field '${unresolvable}', which does not exist in table '${tableName}'. ` +
      `Available: ${[...declaredFields].join(', ')}`,
    unresolvable
  )
}

/**
 * List records matching a filter and return their `id`s.
 *
 * Accesses the table repository directly (rather than through
 * `createListRecordsProgram`) because record action handlers have no `userRole`
 * context — they operate with the guest session the automation engine threads
 * through every record action. They DO receive the `App`, which is where
 * `declaredFields` comes from; only the caller's identity is absent.
 *
 * A repository failure PROPAGATES. "Matched nothing" and "the lookup failed"
 * are different facts, and only the caller can price the difference: an empty
 * match set is a normal outcome, whereas a typo'd filter column, a permission
 * failure or a connection blip means the action does not know what it was
 * supposed to act on. Collapsing the second into the first — which this helper
 * used to do unconditionally — lets a nightly purge report a clean run forever
 * while deleting nothing.
 *
 * An uncompilable filter still resolves to `[]` without attempting a query;
 * callers MUST treat that as a refusal (see {@link toQueryFilter}).
 *
 * A filter naming a field that resolves to no column fails with an
 * {@link UnknownFilterFieldError} BEFORE any SQL is built. `declaredFields` is
 * a required parameter rather than an optional one on purpose: this is the one
 * chokepoint every record operator's condition lookup passes through, and an
 * optional set would let a call site opt out of the check by saying nothing —
 * which is precisely how the six operators came to disagree about filters
 * before they shared this module. Build it with {@link declaredFieldNames}.
 */
export const resolveIdsByFilter = (
  tableName: string,
  filter: unknown,
  declaredFields: ReadonlySet<string> | undefined
): Effect.Effect<readonly string[], DatabaseError | UnknownFilterFieldError, TableRepository> =>
  Effect.gen(function* () {
    const queryFilter = toQueryFilter(filter)
    if (queryFilter === undefined) return [] as const
    const refusal = filterFieldRefusal(tableName, queryFilter, declaredFields)
    if (refusal !== undefined) return yield* Effect.fail(refusal)
    const repo = yield* TableRepository
    const records = yield* repo.listRecords({
      session: buildGuestSession(),
      tableName,
      filter: queryFilter,
    })
    return records.flatMap((row) => {
      const { id } = row as Record<string, unknown>
      // Records can carry a numeric id (DB serial) or a string id (UUID).
      // `updateRecordProgram` accepts either via `String(id)`.
      if (typeof id === 'string' && id !== '') return [id]
      if (typeof id === 'number' && Number.isFinite(id)) return [String(id)]
      return []
    })
  })

/**
 * {@link resolveIdsByFilter} under the LENIENT policy every record action
 * shipped with before `batchDelete` was found reporting a failed lookup as
 * `matched: 0, deleted: 0` and succeeding: a repository failure degrades to
 * "matched nothing".
 *
 * Kept deliberately as a NAMED export rather than an inline `orElseSucceed` so
 * the sites still carrying that risk stay greppable and countable. Their
 * exposure is not equal:
 *
 *   - `record/update`      — a failed lookup silently no-ops and succeeds.
 *   - `record/delete`      — the same, reporting `deletedCount: 0`.
 *   - `record/batchUpdate` — the item fails, but blames the wrong thing
 *                            ("matched no records" rather than the DB error).
 *   - `record/upsert`, `record/batchUpsert` — the sharpest: a failed lookup
 *                            reads as "no existing row", so the action CREATES
 *                            one, and every retry duplicates it.
 *
 * Tightening those is a behaviour change to five shipped operators, not a
 * defect fix, so it belongs to a deliberate decision rather than to the
 * `batchDelete` repair. Migrate a caller by switching it back to
 * {@link resolveIdsByFilter} and handling the error explicitly.
 *
 * The leniency is scoped to `DatabaseError` ALONE. An
 * {@link UnknownFilterFieldError} travels through untouched, because degrading
 * it would defeat the check it comes from: on SQLite the alternative to
 * refusing an unknown field is not "match nothing" but "match EVERYTHING", and
 * a `record/delete` that reports a clean run after emptying a table is the
 * exact failure the lenient policy was already criticised for hiding. It is
 * also not the kind of fact leniency is for — a lost round-trip may succeed on
 * retry, whereas a filter naming a column that does not exist never will.
 */
export const resolveIdsByFilterLenient = (
  tableName: string,
  filter: unknown,
  declaredFields: ReadonlySet<string> | undefined
): Effect.Effect<readonly string[], UnknownFilterFieldError, TableRepository> =>
  resolveIdsByFilter(tableName, filter, declaredFields).pipe(
    Effect.catchTag('DatabaseError', () => Effect.succeed([] as const))
  )

/**
 * Either the rows an action's filter targets, or the outcome refusing it.
 *
 * A tagged union rather than `readonly string[] | ActionOutcome` because
 * `Array.isArray` is declared `(arg: any) => arg is any[]` and so does NOT
 * narrow a READONLY array out of a union — the refusal branch would still be
 * typed as possibly-an-array and every call site would need a cast.
 */
export type ActionTargets =
  | { readonly resolved: true; readonly ids: readonly string[] }
  | { readonly resolved: false; readonly outcome: ActionOutcome }

/**
 * The row ids a record action's `filter` targets — or the {@link ActionOutcome}
 * refusing the action, when the filter names a column that does not exist.
 *
 * Bundles the three things every condition-based record operator did by hand:
 * the `id equals` fast path, the lenient lookup, and now the refusal. They are
 * bundled rather than left to each handler because the handlers are the layer
 * that has already drifted once — `record/delete` and `record/batchDelete`
 * disagreed about whether a failed lookup is a success — and a check spread
 * across five call sites is five chances to acquire a sixth opinion.
 *
 * `resolved: true` carries the match set — possibly empty, which is a normal
 * outcome each operator prices for itself. `resolved: false` carries the
 * outcome to return unchanged.
 */
export const resolveActionTargetIds = (input: {
  /** The operator name used in the refusal message, e.g. `record.delete`. */
  readonly operator: string
  readonly tableName: string
  readonly filter: unknown
  readonly declaredFields: ReadonlySet<string> | undefined
  /** An explicit id that pre-empts the filter (only `record/upsert` has one). */
  readonly idFastPath?: string | undefined
}): Effect.Effect<ActionTargets, never, TableRepository> =>
  Effect.gen(function* () {
    const explicit = input.idFastPath
    const fastPath =
      explicit !== undefined && explicit !== '' ? explicit : extractIdFromFilter(input.filter)
    if (fastPath !== undefined) return { resolved: true, ids: [fastPath] } as const

    const lookup = yield* Effect.result(
      resolveIdsByFilterLenient(input.tableName, input.filter, input.declaredFields)
    )
    return lookup._tag === 'Failure'
      ? ({
          resolved: false,
          outcome: {
            status: 'failure',
            error: `${input.operator} could not resolve its filter: ${errorMessageOf(lookup.failure)}`,
          },
        } as const)
      : ({ resolved: true, ids: lookup.success } as const)
  })

/** An unknown throwable's message, without assuming it is an `Error`. */
export const errorMessageOf = (value: unknown): string =>
  value instanceof Error ? value.message : String(value)

/** A failure outcome carrying an unknown throwable's message. */
export const failureFromError = (err: unknown): ActionOutcome => ({
  status: 'failure',
  error: errorMessageOf(err),
})
