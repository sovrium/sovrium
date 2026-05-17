/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import { createRecordProgram, updateRecordProgram } from '@/application/use-cases/tables/programs'
import { buildGuestSession } from '../build-guest-session'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { QueryFilter } from '@/application/ports/repositories/table-repository'

/**
 * `record/create` handler — creates a row in the named table using the
 * automation's guest session. Accepts `data` or `fields` as the payload key
 * (the spec uses `data`; older shapes use `fields`).
 */
export const handleRecordCreate: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    const fields = recordProp(props, 'data') ?? recordProp(props, 'fields') ?? {}

    if (!tableName) {
      return { status: 'failure', error: 'record.create requires a table name' } as const
    }

    const program = createRecordProgram({
      session: buildGuestSession(),
      tableName,
      fields,
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
  const firstError = results.find((r) => r._tag === 'Left')
  return firstError && firstError._tag === 'Left'
    ? errorMessageOf(firstError.left)
    : 'batch create failed'
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
export const handleRecordBatchCreate: ActionHandler = (action, _app, _automation, runContext) =>
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

    const session = buildGuestSession()
    const results = yield* Effect.forEach(items, (item) => {
      const fields =
        item !== null && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return Effect.either(createRecordProgram({ session, tableName, fields }))
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
export const handleRecordUpdate: ActionHandler = (action, _app, _automation) =>
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

    const session = buildGuestSession()
    const updates = yield* Effect.either(
      Effect.forEach(
        idsToUpdate,
        (recordId) => updateRecordProgram(session, tableName, recordId, { fields: data }),
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
 * the response JSON (the contract AC-001 asserts against).
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
