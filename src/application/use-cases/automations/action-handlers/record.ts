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
import { buildGuestSession, buildSystemSession } from '../build-guest-session'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'

export const handleRecordCreate: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table')
    const fields = recordProp(props, 'data') ?? recordProp(props, 'fields') ?? {}

    if (!tableName) {
      return { status: 'failure', error: 'record.create requires a table name' } as const
    }

    const program = createRecordProgram({
      session: buildSystemSession(),
      tableName,
      fields: {
        ...fields,
        ...buildCreateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID),
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

export const handleRecordUpdate: ActionHandler = (action, app, _automation) =>
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
      return { status: 'success' } as const
    }

    const session = buildSystemSession()
    const fieldsWithAuthorship = {
      ...data,
      ...buildUpdateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID),
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

const upsertCreate = (
  tableName: string,
  data: Readonly<Record<string, unknown>>,
  createOverrides: Readonly<Record<string, string>>
): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const created = yield* Effect.either(
      createRecordProgram({
        session: buildSystemSession(),
        tableName,
        fields: { ...data, ...createOverrides },
      })
    )
    return created._tag === 'Left'
      ? failureFromError(created.left)
      : ({ status: 'success', output: { operation: 'created' } } as const)
  })

const upsertUpdate = (
  tableName: string,
  matchedIds: readonly string[],
  data: Readonly<Record<string, unknown>>,
  updateOverrides: Readonly<Record<string, string>>
): Effect.Effect<ActionOutcome, never, TableRepository> =>
  Effect.gen(function* () {
    const session = buildSystemSession()
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

export const handleRecordUpsert: ActionHandler = (action, app, _automation) =>
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

    return matchedIds.length === 0
      ? yield* upsertCreate(
          tableName,
          data,
          buildCreateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID)
        )
      : yield* upsertUpdate(
          tableName,
          matchedIds,
          data,
          buildUpdateAuthorshipOverrides(app.tables, tableName, SYSTEM_USER_ID)
        )
  })

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
      return { status: 'success', output: { deletedCount: 0 } } as const
    }

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
      if (typeof id === 'string' && id !== '') return [id]
      if (typeof id === 'number' && Number.isFinite(id)) return [String(id)]
      return []
    })
  })

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
    return {
      status: 'failure',
      error: 'record.read requires either props.id or props.filter',
    } as const
  })
