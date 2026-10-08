/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { buildUpdateAuthorshipOverrides } from '@/domain/models/app/tables/authorship-fields'
import { buildGuestSession, buildSyntheticSession } from '../build-guest-session'
import {
  callerRefusal,
  deletesOf,
  runLinkReader,
  runReadAccess,
  type RunReadAccess,
  updatesOf,
  writeRefusal,
  writerActorOf,
} from './record-caller-gate'
import { automationCreateFields } from './record-create-fields'
import { createAndAnnounce, deleteAndAnnounce, updateAndAnnounce } from './record-events'
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
import { buildReadOutput } from './record-read-output'
import {
  listableFields,
  listForRun,
  READ_REFUSAL,
  readableRows,
  scopedListFilter,
} from './record-read-scope'
import { recordUpdatePrecheck } from './record-update-precheck'
import { describeWriteFailure } from './record-write-failure'
import { actionAttributes, findMultiSelectViolationMessage, recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'

/**
 * Resolve the actor id a record write should be attributed to.
 *
 * A run someone started by hand is always attributed to them (the rule that a manual run writes as the person who started it, which
 * subsumes `runAs` there). Otherwise, when the action opts into
 * `runAs: 'triggering-user'` AND the automation carries a triggering user
 * (form submitter, record-event actor, authenticated webhook caller), the
 * write — both its session and its authorship overrides — is attributed to
 * that user. An absent/`'system'` `runAs`, or a user-less trigger (cron,
 * `automation:call`), falls back to the durable system actor, byte-identical to
 * the pre-runAs default. `actorId` is only ever a runtime trigger actor, never
 * author-supplied config, so there is no spoofing surface.
 */
export const resolveRunAsActor = (
  props: Readonly<Record<string, unknown>>,
  automation: AutomationContext
): string =>
  props['runAs'] === 'triggering-user' && automation.userId
    ? automation.userId
    : writerActorOf(automation)

/**
 * `record/create` handler — creates a row in the named table using the
 * automation's guest session. Accepts `data` or `fields` as the payload key
 * (the spec uses `data`; older shapes use `fields`).
 */
export const handleRecordCreate: ActionHandler = (action, app, automation, runContext) =>
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
    const refused = yield* writeRefusal({
      ...{ app, automation, runContext, tableName, event: 'create' },
      requests: [{ op: 'create', tableName, fields }],
    })
    if (refused !== undefined) return refused

    // Actor authority: the automation engine writes with a durable, non-null
    // actor id (not the NULL-normalized guest id) so NOT-NULL authorship
    // columns are satisfied. `runAs: 'triggering-user'` attributes
    // the write to the triggering user when one exists; otherwise the system
    // actor. The synthetic session drives the literal `created_by` infra
    // injection; custom-named `created-by` fields (e.g. `author`) are stamped
    // by name via the override map.
    const actorId = resolveRunAsActor(props, automation)
    // The records API's create road: the new record fires its table's webhooks,
    // and starts its record automations through the run's channel.
    const result = yield* Effect.result(
      createAndAnnounce({
        session: buildSyntheticSession(actorId),
        app,
        tableName,
        fields: automationCreateFields(app, tableName, fields, actorId),
        runContext,
      })
    )
    if (result._tag === 'Failure') {
      // The column the database refused and its reason, for the run history.
      return { status: 'failure', error: describeWriteFailure(result.failure, fields) } as const
    }
    // A later step reads its id as `{{<step>.result.id}}`.
    return { status: 'success', output: { id: result.success.id } } as const
  }).pipe(
    Effect.withSpan('automations.handle-record-create', { attributes: actionAttributes(action) })
  )

/**
 * `record/update` handler — resolve the rows to change, then update each one
 * via `updateRecordProgram` (the table repository's permission + audit
 * pipeline). The rows are named by `props.id` (a code call's shorthand; the
 * declarative schema requires a `filter`) or by any ConditionGroup the
 * records-API accepts, an `id equals` filter taking the fast path that skips
 * the list query. The output is `{ updated, ids }`, the same `updated` key
 * `record/batchUpdate` reports; a filter matching nothing is `{ updated: 0,
 * ids: [] }`, consistent with SQL UPDATE. A call naming no row at all — only a
 * code call can — fails rather than reporting a success that changed nothing.
 */
export const handleRecordUpdate: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    const data = recordProp(props, 'data') ?? recordProp(props, 'fields') ?? {}
    const id = stringProp(props, 'id')

    if (!tableName) {
      return { status: 'failure', error: 'record.update requires a table name' } as const
    }
    const precheck = recordUpdatePrecheck({ app, props, id, tableName, data, runContext })
    if (precheck !== undefined) return precheck

    // Lenient lookup — a failed query reads as "matched nothing" (see
    // `resolveIdsByFilterLenient`); a filter naming a missing column is refused.
    const targets = yield* resolveActionTargetIds({
      operator: 'record.update',
      tableName,
      filter: props['filter'],
      declaredFields: declaredFieldNames(app, tableName),
      idFastPath: id,
    })
    if (!targets.resolved) return targets.outcome
    const idsToUpdate: readonly string[] = targets.ids

    if (idsToUpdate.length === 0) {
      return { status: 'success', output: { updated: 0, ids: [] } } as const
    }
    const refused = yield* callerRefusal(app, automation, updatesOf(tableName, idsToUpdate, data))
    if (refused !== undefined) return refused

    return yield* applyRecordUpdates({
      actorId: resolveRunAsActor(props, automation),
      tableName,
      idsToUpdate,
      data,
      app,
      linkReader: yield* runLinkReader(automation),
      runContext,
    })
  }).pipe(
    Effect.withSpan('automations.handle-record-update', { attributes: actionAttributes(action) })
  )

/**
 * Write branch of `record/update` — stamp authorship, then update each matched
 * row (extracted to keep the handler within its `max-statements` budget).
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
  readonly app: App
  readonly linkReader: LinkReader | undefined
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ActionOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const { actorId, tableName, idsToUpdate, data, app, linkReader, runContext } = config
    const session = buildSyntheticSession(actorId)
    const fieldsWithAuthorship = {
      ...data,
      ...buildUpdateAuthorshipOverrides(app.tables, tableName, actorId),
    }
    const updates = yield* Effect.result(
      Effect.forEach(
        idsToUpdate,
        (recordId) =>
          updateAndAnnounce({
            session,
            tableName,
            recordId,
            fields: fieldsWithAuthorship,
            runContext,
            app,
            linkReader,
          }),
        { discard: true }
      )
    )
    return updates._tag === 'Failure'
      ? failureFromError(updates.failure)
      : ({
          status: 'success',
          output: { updated: idsToUpdate.length, ids: idsToUpdate.map(String) },
        } as const)
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
export const handleRecordDelete: ActionHandler = (action, app, automation, runContext) =>
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
    const refused = yield* writeRefusal({
      ...{ app, automation, runContext, tableName, event: 'delete' },
      requests: deletesOf(tableName, idsToDelete),
    })
    if (refused !== undefined) return refused

    // Soft-delete stamps `deleted_by` with the caller of a hand-started run,
    // else the durable system actor — never NULL under the guest id.
    const session = buildSyntheticSession(writerActorOf(automation))
    const deletes = yield* Effect.result(
      Effect.forEach(
        idsToDelete,
        (recordId) => deleteAndAnnounce({ session, app, tableName, recordId, runContext }),
        { discard: true }
      )
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
 * `record/read`'s only path: straight to `getRecord` (single SELECT by id).
 * Returns the canonical `{ record, records }` envelope so downstream
 * template substitution sees one shape whichever operator produced it.
 */
const readByPrimaryKey = (
  target: { readonly app: App; readonly tableName: string; readonly recordId: string },
  access: RunReadAccess,
  automation: AutomationContext
): Effect.Effect<ActionOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const { app, tableName, recordId } = target
    if (access.kind === 'refused') return READ_REFUSAL
    const repo = yield* TableRepository
    const result = yield* Effect.result(repo.getRecord(buildGuestSession(), tableName, recordId))
    if (result._tag === 'Failure') return failureFromError(result.failure)
    const record = result.success ?? undefined
    const context = { app, tableName, access, automation }
    if (access.kind === 'system') return yield* buildReadOutput(record ? [record] : [], context)
    // A hand-started run reads as its starter: a row they may not read — or one
    // that does not exist, so the two cannot be told apart — fails the step as
    // the records API answers them, and a column they may not read is dropped.
    if (record === undefined || !access.scope.admits(record)) return READ_REFUSAL
    const rows = yield* Effect.result(
      readableRows({ app, tableName, rows: [record], access, automation })
    )
    if (rows._tag === 'Failure') return failureFromError(rows.failure)
    return yield* buildReadOutput(rows.success, context)
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
 * Since the `record.read` split this is the ONLY thing `read` does: `props.id` is required
 * by the schema and `props.filter` is refused at decode. The missing-id
 * guard below is therefore unreachable from a decoded config; it exists for
 * a code-action invoking `record.read` natively (skipping schema
 * validation), which must get a clean failure rather than a NPE inside the
 * repository.
 */
export const handleRecordRead: ActionHandler = (action, app, automation) =>
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
    return yield* readByPrimaryKey(
      { app, tableName, recordId: idValue },
      yield* runReadAccess(app, automation, tableName),
      automation
    )
  }).pipe(
    Effect.withSpan('automations.handle-record-read', { attributes: actionAttributes(action) })
  )

/**
 * The query half of `record/list`: page, order, scope, fetch, trim.
 *
 * The implicit `id ASC` is appended only when a page is actually being cut. An
 * unpaged list returns the whole set, so ties within it can neither hide nor
 * duplicate a row, and adding a key the author never wrote would change the
 * ordering they DID ask for.
 *
 * Each optional argument reaches the port as an explicit `undefined` rather than
 * a conditional spread: the port destructures its config, so an absent key and
 * an undefined one reach the query builders identically.
 */
const runListQuery = (config: {
  readonly app: App
  readonly tableName: string
  readonly props: Readonly<Record<string, unknown>>
  readonly access: RunReadAccess
  readonly queryFilter: QueryFilter | undefined
  readonly sortKeys: readonly SortKey[]
  readonly fields: readonly string[] | undefined
  readonly automation: AutomationContext
}): Effect.Effect<ActionOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const { app, tableName, props, access, queryFilter, sortKeys, fields } = config
    const limit = optionalIntProp(props, 'limit')
    const offset = optionalIntProp(props, 'offset')
    const paginates = limit !== undefined || offset !== undefined
    const sort = sortToPortString(paginates ? withDeterministicTiebreak(sortKeys) : sortKeys)
    const filter = scopedListFilter(queryFilter, access)
    const { automation } = config
    const context = { app, tableName, access, automation, fields }
    if (filter === 'nothing') return yield* buildReadOutput([], context)
    const result = yield* Effect.result(
      listForRun({ app, tableName, access, automation, filter, sort, limit, offset })
    )
    if (result._tag === 'Failure') return failureFromError(result.failure)
    const read = yield* Effect.result(
      readableRows({ app, tableName, rows: result.success, access, automation: config.automation })
    )
    if (read._tag === 'Failure') return failureFromError(read.failure)
    return yield* buildReadOutput(read.success, context)
  })

/**
 * `record/list` handler — the set-shaped read.
 *
 * Owns all four dimensions the `record.read` split split out of `record/read`: which rows
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
export const handleRecordList: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.list requires a table name' } as const
    }
    const access = yield* runReadAccess(app, automation, tableName)
    if (access.kind === 'refused') return READ_REFUSAL

    const declaredFields = listableFields(app, tableName, access)
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

    return yield* runListQuery({
      ...{ app, tableName, props, access, queryFilter, sortKeys, fields },
      automation,
    })
  }).pipe(
    Effect.withSpan('automations.handle-record-list', { attributes: actionAttributes(action) })
  )
