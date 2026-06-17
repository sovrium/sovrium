/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { buildSyntheticSession } from './build-guest-session'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { evaluateRecordTriggerCondition } from './record-trigger-filters'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { App } from '@/domain/models/app'

export interface TriggerRecordEventInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord?: Record<string, unknown>
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly userId?: string
}

const watchFieldsChanged = (
  watchFields: readonly string[],
  record: Record<string, unknown>,
  previousRecord: Record<string, unknown> | undefined
): boolean => {
  if (previousRecord === undefined) return true
  return watchFields.some((field) => {
    const before = previousRecord[field]
    const after = record[field]
    if (before === after) return false
    return JSON.stringify(before) !== JSON.stringify(after)
  })
}

interface RecordEventMatchInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
}

const findMatchingRecordAutomations = (
  input: RecordEventMatchInput
): readonly NonNullable<App['automations']>[number][] => {
  const { app, tableName, event, record, previousRecord } = input
  return (app.automations ?? []).filter((automation) => {
    if (automation.enabled === false) return false
    const { trigger } = automation
    if (trigger.type !== 'record') return false
    if (trigger.table !== tableName) return false
    if (!trigger.events.includes(event)) return false
    if (
      event === 'update' &&
      trigger.watchFields !== undefined &&
      !watchFieldsChanged(trigger.watchFields, record, previousRecord)
    ) {
      return false
    }
    if (
      trigger.condition !== undefined &&
      !evaluateRecordTriggerCondition(trigger.condition, record)
    ) {
      return false
    }
    return true
  })
}

const singleUserFieldNames = (app: App, tableName: string): readonly string[] => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields
    .filter((field): field is typeof field & { readonly allowMultiple?: boolean } => {
      if (field.type !== 'user') return false
      const { allowMultiple } = field as { readonly allowMultiple?: boolean }
      return allowMultiple !== true
    })
    .map((field) => field.name)
}

const withIdToString = (columns: Record<string, unknown>, id: string): Record<string, unknown> =>
  Object.assign(Object.create({ toString: () => id }), columns) as Record<string, unknown>

const firstReverseRowOrEmpty = (
  rows: readonly Record<string, unknown>[]
): Record<string, unknown> => rows[0] ?? {}

const hydrateFields = <Field, R>(
  fields: readonly Field[],
  resolveField: (
    field: Field
  ) => Effect.Effect<readonly [string, Record<string, unknown>] | undefined, never, R>
): Effect.Effect<Record<string, unknown> | undefined, never, R> =>
  Effect.gen(function* () {
    if (fields.length === 0) return undefined
    const resolved = yield* Effect.forEach(fields, resolveField, { concurrency: 1 })
    return Object.fromEntries(
      resolved.filter(
        (entry): entry is readonly [string, Record<string, unknown>] => entry !== undefined
      )
    )
  })

const hydrateUserFields = (input: {
  readonly app: App
  readonly tableName: string
  readonly record: Record<string, unknown>
  readonly userId: string | undefined
}): Effect.Effect<Record<string, unknown>, never, CommentRepository> =>
  Effect.gen(function* () {
    const { app, tableName, record, userId } = input
    const fieldNames = singleUserFieldNames(app, tableName)
    if (fieldNames.length === 0) return record

    const comments = yield* CommentRepository
    const session = buildSyntheticSession(userId ?? '')

    const overlay = yield* hydrateFields(fieldNames, (fieldName) =>
      Effect.gen(function* () {
        const value = record[fieldName]
        if (typeof value !== 'string' || value.length === 0) return undefined
        const metaResult = yield* Effect.either(
          comments.getUserMetadataById({ session, userId: value })
        )
        if (metaResult._tag === 'Left' || !metaResult.right) return undefined
        return [fieldName, withIdToString({ ...metaResult.right }, value)] as const
      })
    )
    return overlay === undefined ? record : { ...record, ...overlay }
  })

const singleRelationshipFields = (
  app: App,
  tableName: string
): readonly { readonly field: string; readonly relatedTable: string }[] => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields
    .filter(
      (
        field
      ): field is typeof field & {
        readonly relatedTable: string
        readonly relationType?: string
        readonly allowMultiple?: boolean
      } => {
        if (field.type !== 'relationship') return false
        const rel = field as {
          readonly relatedTable?: unknown
          readonly relationType?: string
          readonly allowMultiple?: boolean
        }
        if (typeof rel.relatedTable !== 'string' || rel.relatedTable.length === 0) return false
        if (rel.allowMultiple === true) return false
        const relationType = rel.relationType ?? 'many-to-one'
        return relationType === 'many-to-one'
      }
    )
    .map((field) => ({
      field: field.name,
      relatedTable: (field as { readonly relatedTable: string }).relatedTable,
    }))
}

const reverseCollectionFields = (
  app: App,
  tableName: string
): readonly {
  readonly field: string
  readonly relatedTable: string
  readonly reverseFk: string
}[] => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields
    .filter(
      (
        field
      ): field is typeof field & {
        readonly relatedTable: string
        readonly relationType?: string
        readonly foreignKey?: string
        readonly reciprocalField?: string
      } => {
        if (field.type !== 'relationship') return false
        const rel = field as {
          readonly relatedTable?: unknown
          readonly relationType?: string
        }
        if (typeof rel.relatedTable !== 'string' || rel.relatedTable.length === 0) return false
        return rel.relationType === 'one-to-many'
      }
    )
    .map((field) => {
      const rel = field as {
        readonly name: string
        readonly relatedTable: string
        readonly foreignKey?: string
        readonly reciprocalField?: string
      }
      const reverseFk = rel.foreignKey ?? rel.reciprocalField ?? rel.name
      return { field: rel.name, relatedTable: rel.relatedTable, reverseFk }
    })
}

const hydrateReverseCollections = (input: {
  readonly app: App
  readonly relatedTable: string
  readonly parentId: string
  readonly columns: Record<string, unknown>
}): Effect.Effect<Record<string, unknown>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const { app, relatedTable, parentId, columns } = input
    const reverseFields = reverseCollectionFields(app, relatedTable)
    if (reverseFields.length === 0) return columns

    const dataSource = yield* DataSourceRepository

    const overlay = yield* hydrateFields(
      reverseFields,
      ({ field, relatedTable: childTable, reverseFk }) =>
        Effect.gen(function* () {
          const rowsResult = yield* Effect.either(
            dataSource.fetchRecords(childTable, {
              filter: [{ field: reverseFk, operator: 'eq', value: parentId }],
            })
          )
          if (rowsResult._tag === 'Left') return undefined
          const collection = firstReverseRowOrEmpty(rowsResult.right)
          return [field, collection] as const
        })
    )
    return overlay === undefined ? columns : { ...columns, ...overlay }
  })

const hydrateRelationshipFields = (input: {
  readonly app: App
  readonly tableName: string
  readonly record: Record<string, unknown>
}): Effect.Effect<Record<string, unknown>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const { app, tableName, record } = input
    const relations = singleRelationshipFields(app, tableName)
    if (relations.length === 0) return record

    const dataSource = yield* DataSourceRepository

    const overlay = yield* hydrateFields(relations, ({ field, relatedTable }) =>
      Effect.gen(function* () {
        const value = record[field]
        if ((typeof value !== 'string' && typeof value !== 'number') || value === '') {
          return undefined
        }
        const rowResult = yield* Effect.either(
          dataSource.fetchSingleRecord(relatedTable, 'id', String(value))
        )
        if (rowResult._tag === 'Left' || rowResult.right === undefined) return undefined
        const columns = yield* hydrateReverseCollections({
          app,
          relatedTable,
          parentId: String(value),
          columns: rowResult.right,
        })
        return [field, withIdToString(columns, String(value))] as const
      })
    )
    return overlay === undefined ? record : { ...record, ...overlay }
  })

export const triggerRecordEventAutomations = (
  input: TriggerRecordEventInput
): Effect.Effect<
  void,
  never,
  ExecuteAutomationRunRequirements | CommentRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, event, record, previousRecord, processEnv, userId } = input
    const matching = findMatchingRecordAutomations({
      app,
      tableName,
      event,
      record,
      previousRecord,
    })
    if (matching.length === 0) return

    const userHydratedRecord = yield* hydrateUserFields({ app, tableName, record, userId })

    const hydratedRecord = yield* hydrateRelationshipFields({
      app,
      tableName,
      record: userHydratedRecord,
    })

    yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchAutomationOnce({
          automation,
          app,
          processEnv,
          triggerData: { record: hydratedRecord } as unknown as TriggerData,
          userId,
        }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[automation:record-event] dispatch failure', cause)
      })
    )
  )
