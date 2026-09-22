/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { deleteRecordProgram } from '@/application/use-cases/tables/record-lifecycle-programs'
import {
  createRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/write-record-programs'
import { SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/models/app/tables/authorship-fields'
import {
  buildGuestSession,
  buildSyntheticSession,
  buildSystemSession,
} from '../build-guest-session'
import {
  declaredFieldNames,
  extractIdFromFilter,
  failureFromError,
  filterFieldRefusal,
  resolveActionTargetIds,
  selectionFieldRefusal,
  sortFieldRefusal,
  toQueryFilter,
} from './record-filters'
import { actionAttributes, findMultiSelectViolationMessage, recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

/**
 * Resolve the actor id a record write should be attributed to.
 *
 * When the action opts into `runAs: 'triggering-user'` AND the automation
 * carries a triggering user (form submitter, record-event actor, authenticated
 * webhook caller), the write — both its session and its authorship overrides —
 * is attributed to that user. An absent/`'system'` `runAs`, or a user-less
 * trigger (cron, `automation:call`), falls back to the durable system actor,
 * byte-identical to the pre-runAs default. `actorId` is only ever a runtime
 * trigger actor, never author-supplied config, so there is no spoofing surface.
 */
const resolveRunAsActor = (
  props: Readonly<Record<string, unknown>>,
  automation: AutomationContext
): string =>
  props['runAs'] === 'triggering-user' && automation.userId ? automation.userId : SYSTEM_USER_ID

/**
 * `record/create` handler — creates a row in the named table using the
 * automation's guest session. Accepts `data` or `fields` as the payload key
 * (the spec uses `data`; older shapes use `fields`).
 */
export const handleRecordCreate: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    const fields = recordProp(props, 'data') ?? recordProp(props, 'fields') ?? {}

    if (!tableName) {
      return { status: 'failure', error: 'record.create requires a table name' } as const
    }

    // Multi-select membership + cardinality. Checked on the raw author-supplied
    // payload (authorship overrides are system-generated and never
    // multi-select), and checked HERE rather than inside `createRecordProgram`
    // because that program takes `app` OPTIONALLY and this caller has none to
    // give it — validation placed there would silently no-op on this path.
    const multiSelectError = findMultiSelectViolationMessage(app, tableName, fields)
    if (multiSelectError) {
      return { status: 'failure', error: multiSelectError } as const
    }

    // Actor authority: the automation engine writes with a durable, non-null
    // actor id (not the NULL-normalized guest id) so NOT-NULL authorship
    // columns are satisfied. `runAs: 'triggering-user'` attributes
    // the write to the triggering user when one exists; otherwise the system
    // actor. The synthetic session drives the literal `created_by` infra
    // injection; custom-named `created-by` fields (e.g. `author`) are stamped
    // by name via the override map.
    const actorId = resolveRunAsActor(props, automation)
    const program = createRecordProgram({
      session: buildSyntheticSession(actorId),
      tableName,
      fields: {
        ...fields,
        ...buildCreateAuthorshipOverrides(app.tables, tableName, actorId),
      },
    })
    const result = yield* Effect.result(program)
    if (result._tag === 'Failure') {
      const err = result.failure
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'failure', error: message } as const
    }
    return { status: 'success' } as const
  }).pipe(
    Effect.withSpan('automations.handle-record-create', { attributes: actionAttributes(action) })
  )

/**
 * `record/update` handler — apply a filter, then update each matched row
 * via the existing `updateRecordProgram` (which goes through the table
 * repository's permission + audit pipeline).
 *
 * Wave-3 behaviour was limited to `{ field: 'id', operator: 'equals' }` —
 * the canary case used by record-event triggers ("update the record that
 * just changed"). Wave-4 widens it to any ConditionGroup the records-API
 * accepts (`name equals`, `status not_equals`, etc.) so customer YAML can
 * express the natural "update by business key" pattern. The fast-path for
 * `id equals` is preserved so single-record updates skip the list query.
 */
export const handleRecordUpdate: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    const data = recordProp(props, 'data') ?? recordProp(props, 'fields') ?? {}

    if (!tableName) {
      return { status: 'failure', error: 'record.update requires a table name' } as const
    }

    // Multi-select membership + cardinality — see `handleRecordCreate`. Runs
    // BEFORE the target lookup so a bad payload is rejected without spending a
    // query, and so the answer does not depend on whether the filter matched.
    const multiSelectError = findMultiSelectViolationMessage(app, tableName, data)
    if (multiSelectError) {
      return { status: 'failure', error: multiSelectError } as const
    }

    // Lenient lookup — a failed query reads as "matched nothing" and the update
    // then no-ops successfully. Pre-existing behaviour, preserved explicitly;
    // see `resolveIdsByFilterLenient` for why it was not tightened here. A
    // filter naming a column that does not exist is NOT degraded that way.
    const targets = yield* resolveActionTargetIds({
      operator: 'record.update',
      tableName,
      filter: props['filter'],
      declaredFields: declaredFieldNames(app, tableName),
    })
    if (!targets.resolved) return targets.outcome
    const idsToUpdate: readonly string[] = targets.ids

    if (idsToUpdate.length === 0) {
      // No matches — succeed silently. A follow-up spec may surface this as
      // a failure (or as `output: { matchedCount: 0 }`) but today the
      // contract is "no-op when nothing matches", consistent with SQL UPDATE
      // semantics.
      return { status: 'success' } as const
    }

    return yield* applyRecordUpdates({
      actorId: resolveRunAsActor(props, automation),
      tableName,
      idsToUpdate,
      data,
      tables: app.tables,
    })
  }).pipe(
    Effect.withSpan('automations.handle-record-update', { attributes: actionAttributes(action) })
  )

/**
 * Write branch of `record/update` — stamp authorship, then update each matched
 * row.
 *
 * Extracted for the same reason `upsertCreate`/`upsertUpdate` were: it keeps the
 * handler within its `max-statements` budget, and it names the step that carries
 * the actor authority.
 *
 * Actor authority: stamp `updated-by`-typed columns (literal + custom) with the
 * durable actor so the update records WHO changed the row instead of silently
 * wiping authorship to NULL under the guest id. `runAs: 'triggering-user'`
 * re-stamps `updated_by` with the triggering user when one exists;
 * otherwise the system actor (unchanged default).
 */
const applyRecordUpdates = (config: {
  readonly actorId: string
  readonly tableName: string
  readonly idsToUpdate: readonly string[]
  readonly data: Readonly<Record<string, unknown>>
  readonly tables: App['tables']
}): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const { actorId, tableName, idsToUpdate, data, tables } = config
    const session = buildSyntheticSession(actorId)
    const fieldsWithAuthorship = {
      ...data,
      ...buildUpdateAuthorshipOverrides(tables, tableName, actorId),
    }
    const updates = yield* Effect.result(
      Effect.forEach(
        idsToUpdate,
        (recordId) =>
          updateRecordProgram(session, tableName, recordId, { fields: fieldsWithAuthorship }),
        { discard: true }
      )
    )
    return updates._tag === 'Failure'
      ? failureFromError(updates.failure)
      : ({ status: 'success' } as const)
  })

/**
 * `record/upsert` handler — atomic create-or-update on a single record.
 * Looks up an existing row by `props.id` (primary-key fast path) or by an
 * `id equals` filter / arbitrary ConditionGroup. If exactly one match is
 * found it is updated in place (preserving its id); otherwise a new row is
 * created. `data` is required (the schema enforces it); a missing table is a
 * runtime failure.
 *
 * Reuses `extractIdFromFilter` + `resolveIdsByFilter` so the lookup
 * semantics are identical to `record/update`. When the filter matches >1
 * row, all matches are updated (consistent with update's multi-row
 * behaviour) — but the canonical upsert case is the single-row business-key
 * match the specs exercise (upsert by email).
 */
/**
 * Create branch of `record/upsert` — no existing match was found.
 *
 * Single-arg config so the helper stays within the `max-params` budget once the
 * [internal ref] `actorId` is threaded alongside the table/data/overrides.
 */
const upsertCreate = (config: {
  readonly actorId: string
  readonly tableName: string
  readonly data: Readonly<Record<string, unknown>>
  readonly createOverrides: Readonly<Record<string, string>>
}): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const { actorId, tableName, data, createOverrides } = config
    const created = yield* Effect.result(
      createRecordProgram({
        session: buildSyntheticSession(actorId),
        tableName,
        fields: { ...data, ...createOverrides },
      })
    )
    return created._tag === 'Failure'
      ? failureFromError(created.failure)
      : ({ status: 'success', output: { operation: 'created' } } as const)
  })

/**
 * Update branch of `record/upsert` — one or more rows matched.
 *
 * Single-arg config so the helper stays within the `max-params` budget once the
 * [internal ref] `actorId` is threaded alongside the table/matchedIds/data/overrides.
 */
const upsertUpdate = (config: {
  readonly actorId: string
  readonly tableName: string
  readonly matchedIds: readonly string[]
  readonly data: Readonly<Record<string, unknown>>
  readonly updateOverrides: Readonly<Record<string, string>>
}): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const { actorId, tableName, matchedIds, data, updateOverrides } = config
    const session = buildSyntheticSession(actorId)
    const fields = { ...data, ...updateOverrides }
    const updates = yield* Effect.result(
      Effect.forEach(
        matchedIds,
        (recordId) => updateRecordProgram(session, tableName, recordId, { fields }),
        { discard: true }
      )
    )
    return updates._tag === 'Failure'
      ? failureFromError(updates.failure)
      : ({ status: 'success', output: { operation: 'updated' } } as const)
  })

export const handleRecordUpsert: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    const data = recordProp(props, 'data') ?? recordProp(props, 'fields') ?? {}

    if (!tableName) {
      return { status: 'failure', error: 'record.upsert requires a table name' } as const
    }

    // Multi-select membership + cardinality — see `handleRecordCreate`. Checked
    // once here rather than inside `upsertCreate`/`upsertUpdate`: `data` is the
    // same payload on both branches, and neither branch receives `app`.
    const multiSelectError = findMultiSelectViolationMessage(app, tableName, data)
    if (multiSelectError) {
      return { status: 'failure', error: multiSelectError } as const
    }

    // Lenient lookup — pre-existing behaviour, preserved explicitly. Note this
    // is the sharpest of the four lenient sites: a failed query reads as "no
    // existing row", so the upsert takes its CREATE branch and every retry
    // duplicates. See `resolveIdsByFilterLenient`. An unresolvable filter field
    // is refused outright rather than degraded into that create branch.
    const targets = yield* resolveActionTargetIds({
      operator: 'record.upsert',
      tableName,
      filter: props['filter'],
      declaredFields: declaredFieldNames(app, tableName),
      idFastPath: stringProp(props, 'id'),
    })
    if (!targets.resolved) return targets.outcome
    const matchedIds: readonly string[] = targets.ids

    // Actor authority: `runAs: 'triggering-user'` attributes both
    // branches — create-branch `created-by` and update-branch `updated-by` —
    // to the triggering user when one exists, else the system actor.
    const actorId = resolveRunAsActor(props, automation)

    return matchedIds.length === 0
      ? yield* upsertCreate({
          actorId,
          tableName,
          data,
          createOverrides: buildCreateAuthorshipOverrides(app.tables, tableName, actorId),
        })
      : yield* upsertUpdate({
          actorId,
          tableName,
          matchedIds,
          data,
          updateOverrides: buildUpdateAuthorshipOverrides(app.tables, tableName, actorId),
        })
  }).pipe(
    Effect.withSpan('automations.handle-record-upsert', { attributes: actionAttributes(action) })
  )

/**
 * `record/delete` handler — apply a filter, then soft-delete each matched
 * row via the existing `deleteRecordProgram` (which goes through the table
 * repository's permission + cascade pipeline, so `deleted_at` is set rather
 * than a hard row removal).
 *
 * Mirrors `handleRecordUpdate`: an `id equals` filter takes the fast path,
 * any other ConditionGroup is resolved to ids via a list query. A filter
 * that compiles to zero usable conditions is a runtime FAILURE (not a
 * silent no-op) — deleting with an empty/all-matching filter would risk a
 * mass-delete, so the handler refuses rather than degrade. The schema
 * already requires a non-empty `filter` at decode time; this guard defends
 * the code-action invoker path that bypasses schema validation.
 */
export const handleRecordDelete: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.delete requires a table name' } as const
    }

    if (
      toQueryFilter(props['filter']) === undefined &&
      extractIdFromFilter(props['filter']) === undefined
    ) {
      return {
        status: 'failure',
        error: 'record.delete requires a filter with at least one condition',
      } as const
    }

    // Lenient lookup — pre-existing behaviour, preserved explicitly. Unlike
    // `record/batchDelete` (which now fails on a failed lookup) this still
    // reports `deletedCount: 0` and succeeds. See `resolveIdsByFilterLenient`.
    // A filter naming a column that does not exist is refused instead: on
    // SQLite the degraded form of that predicate matches the WHOLE table.
    const targets = yield* resolveActionTargetIds({
      operator: 'record.delete',
      tableName,
      filter: props['filter'],
      declaredFields: declaredFieldNames(app, tableName),
    })
    if (!targets.resolved) return targets.outcome
    const idsToDelete: readonly string[] = targets.ids

    if (idsToDelete.length === 0) {
      // Filter matched no live rows — succeed silently (consistent with SQL
      // DELETE semantics: zero rows affected is not an error).
      return { status: 'success', output: { deletedCount: 0 } } as const
    }

    // System authority — soft-delete stamps `deleted_by` with the durable
    // system actor instead of NULL under the guest id.
    const session = buildSystemSession()
    const deletes = yield* Effect.result(
      Effect.forEach(idsToDelete, (recordId) => deleteRecordProgram(session, tableName, recordId), {
        discard: true,
      })
    )
    if (deletes._tag === 'Failure') {
      const err = deletes.failure
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'failure', error: message } as const
    }
    return { status: 'success', output: { deletedCount: idsToDelete.length } } as const
  }).pipe(
    Effect.withSpan('automations.handle-record-delete', { attributes: actionAttributes(action) })
  )

/**
 * Build the canonical read success output, SHARED by `record/read` and
 * `record/list`. Surfaces both `record` (first row or undefined) and
 * `records` (the whole array), so `{{getUser.record.email}}` works for the
 * single-row case AND `{{listActive.records}}` for the set case.
 *
 * Sharing it is what makes the [internal ref] operator split invisible downstream:
 * a config migrating a filtered `read` to a `list` keeps every template it
 * had. Do not give `list` its own envelope.
 *
 * The webhook dispatcher serialises this object under the response's
 * top-level `output` key, so any field on the row appears verbatim
 * somewhere in the response JSON (the contract [internal ref] asserts against).
 */
const buildReadOutput = (records: readonly Readonly<Record<string, unknown>>[]): ActionOutcome => ({
  status: 'success',
  output: {
    record: records[0] ?? undefined,
    records,
  },
})

/**
 * `record/read`'s only path: straight to `getRecord` (single SELECT by id).
 * Returns the canonical `{ record, records }` envelope so downstream
 * template substitution sees one shape whichever operator produced it.
 */
const readByPrimaryKey = (
  tableName: string,
  recordId: string
): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const result = yield* Effect.result(repo.getRecord(buildGuestSession(), tableName, recordId))
    if (result._tag === 'Failure') return failureFromError(result.failure)
    const record = result.success
    return buildReadOutput(record ? [record] : [])
  })

/** One decoded `record/list` sort key, with its direction already resolved. */
interface SortKey {
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

/**
 * Read `props.sort` defensively into resolved sort keys.
 *
 * The schema already guarantees the shape for a decoded config, but a code
 * action invokes operators natively and skips decode entirely, so a malformed
 * entry has to degrade to "not a sort key" rather than reach SQL as `undefined`.
 *
 * Anything that is not exactly `'desc'` is ascending — the same default
 * `buildSortClause` applies downstream and the same one `releaseSortFromProps`
 * applies elsewhere. Restating it here rather than passing the raw value on
 * keeps the two from drifting into disagreeing about, say, `'DESC'`.
 */
const readSortKeys = (value: unknown): readonly SortKey[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): readonly SortKey[] => {
    if (!entry || typeof entry !== 'object') return []
    const { field, direction } = entry as { readonly field?: unknown; readonly direction?: unknown }
    if (typeof field !== 'string' || field === '') return []
    return [{ field, direction: direction === 'desc' ? 'desc' : 'asc' }]
  })
}

/**
 * Append `id ASC` as the FINAL ordering key unless the author already ordered
 * by `id` themselves.
 *
 * Applied whenever pagination is in play, not merely when `sort` is absent.
 * That distinction is the whole point: a page boundary falling inside a group
 * of rows tied on the author's sort key lets the engine return one of them on
 * both pages and neither on either — the same duplicate-and-skip defect an
 * unordered `OFFSET` has, arriving through a query that looks ordered. A TOTAL
 * order is the requirement, and only a unique column supplies one.
 *
 * `id` is exempt because ordering by it twice adds a no-op key that shows up in
 * every EXPLAIN and reads as a mistake.
 */
const withDeterministicTiebreak = (keys: readonly SortKey[]): readonly SortKey[] =>
  keys.some((key) => key.field === 'id') ? keys : [...keys, { field: 'id', direction: 'asc' }]

/**
 * Compile sort keys into the repository port's existing `field:dir,field:dir`
 * string.
 *
 * The port needs no change for sorting at all — `buildOrderByClause` already
 * compiles multi-key strings, single-select CASE ordering included. Encoding
 * here rather than widening the port keeps `record/list` from becoming the one
 * caller with a bespoke sort protocol.
 *
 * The encoding is only unambiguous because `,` and `:` cannot appear in a
 * resolvable column name, which {@link sortFieldRefusal} has already enforced
 * by the time this runs. That ordering is deliberate, not incidental.
 */
const sortToPortString = (keys: readonly SortKey[]): string | undefined =>
  keys.length > 0 ? keys.map((key) => `${key.field}:${key.direction}`).join(',') : undefined

/** Read an optional non-negative integer prop, or undefined when absent/unusable. */
const optionalIntProp = (
  props: Readonly<Record<string, unknown>>,
  key: string
): number | undefined => {
  const raw = props[key]
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw : undefined
}

/**
 * Read `props.fields` into a non-empty selection, or undefined for "no trim".
 *
 * An empty array reaches undefined rather than "select nothing": the schema
 * rejects `fields: []` at decode, so the only way here is a code action, and
 * returning every column is the safer of the two readings of a selection that
 * selects nothing.
 */
const readFieldNames = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const names = value.filter((name): name is string => typeof name === 'string' && name !== '')
  return names.length > 0 ? names : undefined
}

/**
 * The keys a trim keeps whatever the caller asked for.
 *
 * `id` is the addressable handle downstream steps use to act on what the list
 * found — a trim that removed it would return rows nothing else could
 * reference. The two timestamps are here so this surface answers the SAME shape
 * as the records API's `?fields=`, which keeps `createdAt`/`updatedAt` on the
 * envelope whatever is requested. The first version of this trim kept only
 * `id`, so the two read surfaces answered differently for the same table and a
 * template author had to know which one they were standing in.
 *
 * Guarded by `Object.hasOwn` at the call site, so a table without a timestamp
 * column simply does not get the key rather than getting an `undefined` one.
 */
const ALWAYS_KEPT_COLUMNS = ['id', 'created_at', 'updated_at'] as const

/**
 * Trim each row to {@link ALWAYS_KEPT_COLUMNS} plus the requested columns.
 *
 * ⚠️ This is a PAYLOAD TRIM, not a permission boundary. Every read-permission
 * decision lives in `filterReadableFields`, which needs a `userRole` the
 * automation path does not have — record actions run under the engine's guest
 * session. `fields` narrows what a template or a webhook response carries; it
 * grants and withholds nothing. Anyone who can edit the config can already read
 * the whole row by deleting the prop.
 *
 * The keys are raw snake_case column names, not the API envelope's camelCase:
 * an automation returns FLAT database rows, which is also why
 * `applyFieldSelection` cannot be reused here — it answers the nested
 * `{ id, fields: {…} }` envelope instead.
 *
 * `formula`, `lookup`, `rollup` and `count` columns need no special handling:
 * the relation `listRecords` targets is the VIEW when one exists, so each is
 * addressable under its own name and arrives already computed. Trimming by key
 * therefore keeps them, where a trim built on "does this field own a base
 * column" would drop exactly the computed values that were asked for.
 */
const trimToFields = (
  records: readonly Readonly<Record<string, unknown>>[],
  fields: readonly string[]
): readonly Readonly<Record<string, unknown>>[] =>
  records.map((record) =>
    [...ALWAYS_KEPT_COLUMNS, ...fields].reduce<Record<string, unknown>>(
      (acc, key) => (Object.hasOwn(record, key) ? { ...acc, [key]: record[key] } : acc),
      {}
    )
  )

/**
 * Adjudicate a `record/list`'s two author-supplied identifier surfaces, or
 * return the refusal that stops it before any SQL is built.
 *
 * Both refusals run ahead of the query for the same reason: on SQLite an
 * unknown double-quoted identifier is not an error but a string LITERAL. In a
 * filter that makes `"knid" = 'knid'` true on every row and hands the ENTIRE
 * table to whoever supplied the name; in an ORDER BY it makes every row sort by
 * the same constant, so the rows come back unordered with a SUCCESSFUL run.
 * Postgres raises 42703 for both and fails closed, which is precisely why
 * neither can be left to the engine to catch.
 *
 * A filter that is PRESENT but compiles to zero conditions is refused too. An
 * absent filter legitimately means "every non-deleted row"; an empty one means
 * the author expressed a restriction that evaporated, and reading it as "match
 * everything" is how a read becomes a full-table disclosure.
 */
const listRefusal = (config: {
  readonly tableName: string
  readonly filterPresent: boolean
  readonly queryFilter: QueryFilter | undefined
  readonly sortKeys: readonly SortKey[]
  readonly selectedFields: readonly string[]
  readonly declaredFields: ReadonlySet<string> | undefined
}): string | undefined => {
  const { tableName, filterPresent, queryFilter, sortKeys, selectedFields, declaredFields } = config
  if (filterPresent && queryFilter === undefined) {
    return 'record.list filter must contain at least one condition'
  }
  const filterRefusal =
    queryFilter === undefined
      ? undefined
      : filterFieldRefusal(tableName, queryFilter, declaredFields)
  if (filterRefusal !== undefined) {
    return `record.list could not resolve its filter: ${filterRefusal.message}`
  }
  const orderRefusal = sortFieldRefusal(
    tableName,
    sortKeys.map((key) => key.field),
    declaredFields
  )
  if (orderRefusal !== undefined) {
    return `record.list could not resolve its sort: ${orderRefusal.message}`
  }
  const selectionRefusal = selectionFieldRefusal(tableName, selectedFields, declaredFields)
  return selectionRefusal === undefined
    ? undefined
    : `record.list could not resolve its fields: ${selectionRefusal.message}`
}

/**
 * `record/read` handler — fetch a single record by primary key.
 *
 * Since [internal ref] this is the ONLY thing `read` does: `props.id` is required
 * by the schema and `props.filter` is refused at decode. The missing-id
 * guard below is therefore unreachable from a decoded config; it exists for
 * a code-action invoking `record.read` natively (skipping schema
 * validation), which must get a clean failure rather than a NPE inside the
 * repository.
 */
export const handleRecordRead: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.read requires a table name' } as const
    }
    const idRaw = props['id']
    const idValue = typeof idRaw === 'string' && idRaw !== '' ? idRaw : undefined
    if (idValue === undefined) {
      return { status: 'failure', error: 'record.read requires props.id' } as const
    }
    return yield* readByPrimaryKey(tableName, idValue)
  }).pipe(
    Effect.withSpan('automations.handle-record-read', { attributes: actionAttributes(action) })
  )

/**
 * `record/list` handler — the set-shaped read.
 *
 * Owns all four dimensions [internal ref] split out of `record/read`: which rows
 * (`filter`), in what order (`sort`), how many and from where (`limit` /
 * `offset`), carrying which columns (`fields`). Ordering and paging are pushed
 * into SQL; only the payload trim is applied in memory.
 *
 * Omitting `filter` entirely is legal and means "every non-deleted row"; only a
 * filter that is PRESENT but empty is refused.
 *
 * `app` is threaded into the repository call and it is load-bearing rather than
 * incidental. Without it `buildSortClause` cannot see a `single-select` field's
 * declared options, so it falls through to a plain `"status" ASC` and orders
 * the labels ALPHABETICALLY instead of by declared option index — a quiet wrong
 * answer on a successful run, which is the failure mode this whole surface is
 * built to avoid.
 */
export const handleRecordList: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.list requires a table name' } as const
    }

    const declaredFields = declaredFieldNames(app, tableName)
    const queryFilter = props['filter'] === undefined ? undefined : toQueryFilter(props['filter'])
    const sortKeys = readSortKeys(props['sort'])
    const fields = readFieldNames(props['fields'])

    const refusal = listRefusal({
      tableName,
      filterPresent: props['filter'] !== undefined,
      queryFilter,
      sortKeys,
      selectedFields: fields ?? [],
      declaredFields,
    })
    if (refusal !== undefined) {
      return { status: 'failure', error: refusal } as const
    }

    const limit = optionalIntProp(props, 'limit')
    const offset = optionalIntProp(props, 'offset')
    // The implicit `id ASC` is appended only when a page is actually being cut.
    // An unpaged list returns the whole set, so ties within it can neither hide
    // nor duplicate a row, and adding a key the author never wrote would change
    // the ordering they DID ask for.
    const paginates = limit !== undefined || offset !== undefined
    const sort = sortToPortString(paginates ? withDeterministicTiebreak(sortKeys) : sortKeys)

    const repo = yield* TableRepository
    // Each optional argument is passed as an explicit `undefined` rather than
    // conditionally spread: the port destructures its config, so an absent key
    // and an undefined one reach the query builders identically, and four
    // spread-ternaries here would buy nothing but branches.
    const result = yield* Effect.result(
      repo.listRecords({
        session: buildGuestSession(),
        tableName,
        app,
        filter: queryFilter,
        sort,
        limit,
        offset,
      })
    )
    if (result._tag === 'Failure') return failureFromError(result.failure)

    return buildReadOutput(
      fields === undefined ? result.success : trimToFields(result.success, fields)
    )
  }).pipe(
    Effect.withSpan('automations.handle-record-list', { attributes: actionAttributes(action) })
  )
