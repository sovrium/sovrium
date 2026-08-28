/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  createRecordProgram,
  deleteRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/programs'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/services/authorship-fields'
import { SYSTEM_USER_ID } from '@/domain/services/guest-session'
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
  toQueryFilter,
} from './record-filters'
import { findMultiSelectViolationMessage, recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
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
  })

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
  })

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
  })

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
  })

/**
 * Build the canonical `record/read` success output. Surfaces both
 * `record` (first match or undefined) and `records` (the match array) so
 * `{{getUser.record.email}}` works for the canary single-row case AND
 * `{{listActive.records}}` survives when authors widen the filter to
 * multi-row reads — same operator, no schema split. The webhook
 * dispatcher serialises this object under the response's top-level
 * `output` key, so any field on the row appears verbatim somewhere in
 * the response JSON (the contract [internal ref] asserts against).
 */
const buildReadOutput = (records: readonly Readonly<Record<string, unknown>>[]): ActionOutcome => ({
  status: 'success',
  output: {
    record: records[0] ?? undefined,
    records,
  },
})

/**
 * Primary-key fast path for `record/read`. Goes straight to `getRecord`
 * (single SELECT by id) rather than walking `listRecords`. Returns a
 * canonical `{ record, records }` output so downstream template
 * substitution sees the same shape regardless of which lookup path the
 * action took.
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

/**
 * Filter path for `record/read`. Compiles the spec-shape filter into the
 * repository's `QueryFilter` and dispatches to `listRecords`. A filter
 * with zero usable conditions is a runtime failure — the schema rejects
 * empty `conditions` arrays at decode time, but a code-action invoker
 * (which bypasses schema validation) could still arrive here with an
 * empty filter, and that should not silently degrade to "read everything".
 *
 * A filter naming a field that resolves to no column is refused on the same
 * principle, and it is the same refusal the write operators use. `record/read`
 * was the one operator that never reached the shared seam: it called
 * `toQueryFilter` and handed the result straight to `listRecords`, so it never
 * passed `declaredFields`. On SQLite — the zero-config default engine — an
 * unknown double-quoted identifier degrades to a string literal, so
 * `"knid" = 'knid'` is TRUE on every row and the ENTIRE table was handed back
 * to whoever supplied the field name. That is the read counterpart of the
 * mass-deletion the write operators already refuse.
 */
const readByFilter = (
  tableName: string,
  filter: unknown,
  declaredFields: ReadonlySet<string> | undefined
): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const queryFilter = toQueryFilter(filter)
    if (queryFilter === undefined) {
      return {
        status: 'failure',
        error: 'record.read filter must contain at least one condition',
      } as const
    }
    const refusal = filterFieldRefusal(tableName, queryFilter, declaredFields)
    if (refusal !== undefined) {
      return {
        status: 'failure',
        error: `record.read could not resolve its filter: ${refusal.message}`,
      } as const
    }
    const repo = yield* TableRepository
    const result = yield* Effect.result(
      repo.listRecords({ session: buildGuestSession(), tableName, filter: queryFilter })
    )
    if (result._tag === 'Failure') return failureFromError(result.failure)
    return buildReadOutput(result.success)
  })

/**
 * `record/read` handler — fetch a single record by primary key (`props.id`)
 * or by filter conditions (`props.filter`). The schema enforces "at least
 * one of id/filter must be present" at decode time, so by the time this
 * handler runs both fields cannot be simultaneously absent. The handler
 * defends against that case anyway and returns a typed failure outcome —
 * upstream tests pin the runtime contract for code-action invokers that
 * skip schema validation.
 */
export const handleRecordRead: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.read requires a table name' } as const
    }
    const idRaw = props['id']
    const idValue = typeof idRaw === 'string' && idRaw !== '' ? idRaw : undefined
    if (idValue !== undefined) return yield* readByPrimaryKey(tableName, idValue)
    if (props['filter'] !== undefined) {
      return yield* readByFilter(tableName, props['filter'], declaredFieldNames(app, tableName))
    }
    // Schema-level enforcement should have rejected this configuration at
    // decode time. The runtime guard exists so a code-action invoking
    // `record.read` natively (skipping schema validation) still gets a
    // clean failure rather than a NPE inside the repository.
    return {
      status: 'failure',
      error: 'record.read requires either props.id or props.filter',
    } as const
  })
