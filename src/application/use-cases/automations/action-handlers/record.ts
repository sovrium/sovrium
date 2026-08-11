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
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'

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
    const result = yield* Effect.either(program)
    if (result._tag === 'Left') {
      const err = result.left
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'failure', error: message } as const
    }
    return { status: 'success' } as const
  })

const errorMessageOf = (value: unknown): string =>
  value instanceof Error ? value.message : String(value)

const firstLeftMessage = <A>(
  results: ReadonlyArray<
    | { readonly _tag: 'Left'; readonly left: unknown }
    | { readonly _tag: 'Right'; readonly right: A }
  >
): string => {
  const firstError = results.find(
    (r): r is { readonly _tag: 'Left'; readonly left: unknown } => r._tag === 'Left'
  )
  return firstError ? errorMessageOf(firstError.left) : 'batch create failed'
}

/**
 * `record/batchCreate` handler — creates many rows in the named table from a
 * template-resolved array. Accepts `records` or `items` as the array key.
 *
 * The array prop is re-resolved from the RAW pre-substitution action against
 * the run-context view, because the run loop's `resolveTriggerInValue` pass
 * stringifies non-scalar leaves (`String([{…}])` → `"[object Object]"`); a
 * whole-string `{{steps.parseCsv.data}}` must survive as the actual array.
 */
export const handleRecordBatchCreate: ActionHandler = (action, app, _automation, runContext) =>
  Effect.gen(function* () {
    const props = runContext
      ? (resolveRunContextValue(
          rawActionProps(runContext),
          buildRunContextView(runContext)
        ) as Record<string, unknown>)
      : ((action['props'] as Record<string, unknown> | undefined) ?? {})

    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.batchCreate requires a table name' } as const
    }
    const itemsRaw = props['records'] ?? props['items']
    const items = Array.isArray(itemsRaw) ? (itemsRaw as ReadonlyArray<unknown>) : []
    const continueOnItemError = props['continueOnItemError'] === true

    // System authority — same rationale as handleRecordCreate.
    const session = buildSystemSession()
    const authorship = buildCreateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID)
    const results = yield* Effect.forEach(items, (item) => {
      const fields =
        item !== null && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return Effect.either(
        createRecordProgram({ session, tableName, fields: { ...fields, ...authorship } })
      )
    })
    const created = results.filter((r) => r._tag === 'Right').length
    const failed = results.length - created
    return failed > 0 && !continueOnItemError
      ? ({
          status: 'failure',
          error: firstLeftMessage(results),
          output: { created, failed },
        } as const)
      : ({ status: 'success', output: { created, failed } } as const)
  })

interface FilterCondition {
  readonly field?: string
  readonly operator?: string
  readonly value?: unknown
}
interface FilterGroup {
  readonly conditions?: readonly FilterCondition[]
}

/**
 * Extract a single record id from a foundational filter shape:
 * `{ conditions: [{ field: 'id', operator: 'equals', value: <id> }] }`.
 *
 * Returns undefined if the filter is missing, has multiple conditions, or
 * does not match the `id equals` shape. Future migration specs widen this
 * to compile filters into a SQL WHERE clause; the foundation only handles
 * the most common case used by record-event triggers (update by id).
 */
const isValidIdEqualsCondition = (condition: FilterCondition): boolean => {
  if (condition.field !== 'id') return false
  if (condition.operator !== 'equals') return false
  if (condition.value === undefined) return false
  if (condition.value === '') return false
  return true
}

const extractIdFromFilter = (filter: unknown): string | undefined => {
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
 * value }] }`) into the repository's `QueryFilter` (`{ and: [...] }`). The
 * two shapes carry the same information; the rename exists because the
 * spec mirrors the records-API public contract while `QueryFilter` is the
 * internal repository protocol.
 */
const toQueryFilter = (filter: unknown): QueryFilter | undefined => {
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

    const idFastPath = extractIdFromFilter(props['filter'])
    const idsToUpdate: readonly string[] = idFastPath
      ? [idFastPath]
      : yield* resolveIdsByFilter(tableName, props['filter'])

    if (idsToUpdate.length === 0) {
      // No matches — succeed silently. A follow-up spec may surface this as
      // a failure (or as `output: { matchedCount: 0 }`) but today the
      // contract is "no-op when nothing matches", consistent with SQL UPDATE
      // semantics.
      return { status: 'success' } as const
    }

    // Actor authority: stamp `updated-by`-typed columns (literal + custom) with
    // the durable actor so the update records WHO changed the row instead of
    // silently wiping authorship to NULL under the guest id. `runAs:
    // 'triggering-user'` re-stamps `updated_by` with the triggering
    // user when one exists; otherwise the system actor (unchanged default).
    const actorId = resolveRunAsActor(props, automation)
    const session = buildSyntheticSession(actorId)
    const fieldsWithAuthorship = {
      ...data,
      ...buildUpdateAuthorshipOverrides(app.tables, tableName, actorId),
    }
    const updates = yield* Effect.either(
      Effect.forEach(
        idsToUpdate,
        (recordId) =>
          updateRecordProgram(session, tableName, recordId, { fields: fieldsWithAuthorship }),
        { discard: true }
      )
    )
    if (updates._tag === 'Left') {
      const err = updates.left
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'failure', error: message } as const
    }
    return { status: 'success' } as const
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
    const created = yield* Effect.either(
      createRecordProgram({
        session: buildSyntheticSession(actorId),
        tableName,
        fields: { ...data, ...createOverrides },
      })
    )
    return created._tag === 'Left'
      ? failureFromError(created.left)
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
    const updates = yield* Effect.either(
      Effect.forEach(
        matchedIds,
        (recordId) => updateRecordProgram(session, tableName, recordId, { fields }),
        { discard: true }
      )
    )
    return updates._tag === 'Left'
      ? failureFromError(updates.left)
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

    const idProp = stringProp(props, 'id')
    const idFastPath = idProp !== '' ? idProp : extractIdFromFilter(props['filter'])
    const matchedIds: readonly string[] = idFastPath
      ? [idFastPath]
      : yield* resolveIdsByFilter(tableName, props['filter'])

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
export const handleRecordDelete: ActionHandler = (action, _app, _automation) =>
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

    const idFastPath = extractIdFromFilter(props['filter'])
    const idsToDelete: readonly string[] = idFastPath
      ? [idFastPath]
      : yield* resolveIdsByFilter(tableName, props['filter'])

    if (idsToDelete.length === 0) {
      // Filter matched no live rows — succeed silently (consistent with SQL
      // DELETE semantics: zero rows affected is not an error).
      return { status: 'success', output: { deletedCount: 0 } } as const
    }

    // System authority — soft-delete stamps `deleted_by` with the durable
    // system actor instead of NULL under the guest id.
    const session = buildSystemSession()
    const deletes = yield* Effect.either(
      Effect.forEach(idsToDelete, (recordId) => deleteRecordProgram(session, tableName, recordId), {
        discard: true,
      })
    )
    if (deletes._tag === 'Left') {
      const err = deletes.left
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'failure', error: message } as const
    }
    return { status: 'success', output: { deletedCount: idsToDelete.length } } as const
  })

/**
 * List records matching the action's filter and return their `id`s. Used
 * by `handleRecordUpdate` when the filter isn't the foundation `id-equals`
 * fast path. Accesses the table repository directly (rather than through
 * `createListRecordsProgram`) because the handler doesn't have an `App` /
 * `userRole` context — it operates with the guest session that the
 * automation engine threads through every record action.
 */
const resolveIdsByFilter = (
  tableName: string,
  filter: unknown
): Effect.Effect<readonly string[], never, TableRepository> =>
  Effect.gen(function* () {
    const queryFilter = toQueryFilter(filter)
    if (queryFilter === undefined) return [] as const
    const repo = yield* TableRepository
    const records = yield* Effect.either(
      repo.listRecords({ session: buildGuestSession(), tableName, filter: queryFilter })
    )
    if (records._tag === 'Left') return [] as const
    return records.right.flatMap((row) => {
      const { id } = row as Record<string, unknown>
      // Records can carry a numeric id (DB serial) or a string id (UUID).
      // `updateRecordProgram` accepts either via `String(id)`.
      if (typeof id === 'string' && id !== '') return [id]
      if (typeof id === 'number' && Number.isFinite(id)) return [String(id)]
      return []
    })
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

const failureFromError = (err: unknown): ActionOutcome => ({
  status: 'failure',
  error: err instanceof Error ? err.message : String(err),
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
    const result = yield* Effect.either(repo.getRecord(buildGuestSession(), tableName, recordId))
    if (result._tag === 'Left') return failureFromError(result.left)
    const record = result.right
    return buildReadOutput(record ? [record] : [])
  })

/**
 * Filter path for `record/read`. Compiles the spec-shape filter into the
 * repository's `QueryFilter` and dispatches to `listRecords`. A filter
 * with zero usable conditions is a runtime failure — the schema rejects
 * empty `conditions` arrays at decode time, but a code-action invoker
 * (which bypasses schema validation) could still arrive here with an
 * empty filter, and that should not silently degrade to "read everything".
 */
const readByFilter = (
  tableName: string,
  filter: unknown
): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const queryFilter = toQueryFilter(filter)
    if (queryFilter === undefined) {
      return {
        status: 'failure',
        error: 'record.read filter must contain at least one condition',
      } as const
    }
    const repo = yield* TableRepository
    const result = yield* Effect.either(
      repo.listRecords({ session: buildGuestSession(), tableName, filter: queryFilter })
    )
    if (result._tag === 'Left') return failureFromError(result.left)
    return buildReadOutput(result.right)
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
export const handleRecordRead: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    if (!tableName) {
      return { status: 'failure', error: 'record.read requires a table name' } as const
    }
    const idRaw = props['id']
    const idValue = typeof idRaw === 'string' && idRaw !== '' ? idRaw : undefined
    if (idValue !== undefined) return yield* readByPrimaryKey(tableName, idValue)
    if (props['filter'] !== undefined) return yield* readByFilter(tableName, props['filter'])
    // Schema-level enforcement should have rejected this configuration at
    // decode time. The runtime guard exists so a code-action invoking
    // `record.read` natively (skipping schema validation) still gets a
    // clean failure rather than a NPE inside the repository.
    return {
      status: 'failure',
      error: 'record.read requires either props.id or props.filter',
    } as const
  })
