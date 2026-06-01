/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import { SessionContextError } from '@/domain/errors'
import {
  computeGroupedAggregations,
  reshapeShortcutAggregations,
  type AggregateConfig,
} from './utils/aggregation-helpers'
import {
  enrichRecordsWithAttachmentUrls,
  enrichRecordWithAttachmentUrls,
} from './utils/attachment-url-enricher'
import { formatFieldForDisplay } from './utils/display-formatter'
import { filterReadableFields } from './utils/field-read-filter'
import { processRecords, applyPagination } from './utils/list-helpers'
import { preserveIdType } from './utils/preserve-id-type'
import { transformRecord } from './utils/record-transformer'
import type { TransformedRecord } from './utils/record-transformer'
import type { UserSession } from '@/application/ports/models/user-session'
import type {
  ListRecordsResponse,
  GetRecordResponse,
  RestoreRecordResponse,
} from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

export {
  TableNotFoundError,
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
  listViewsProgram,
  getViewProgram,
  getViewRecordsProgram,
} from './table-operations'

export {
  batchCreateProgram,
  batchUpdateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  upsertProgram,
} from './batch-operations'

interface ListRecordsConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
  readonly format?: 'display'
  readonly timezone?: string
  readonly sort?: string
  readonly fields?: string
  readonly limit?: number
  readonly offset?: number
  readonly aggregate?: AggregateConfig
  readonly groupBy?: string
  readonly origin?: string
}

function toGroupName(record: Readonly<Record<string, unknown>>, groupBy: string): string {
  const raw = record[groupBy]
  return raw === null || raw === undefined ? '' : String(raw)
}

function computeGroupCounts(
  records: readonly Readonly<Record<string, unknown>>[],
  groupBy: string
): ReadonlyMap<string, number> {
  return records.reduce<ReadonlyMap<string, number>>((acc, r) => {
    const name = toGroupName(r, groupBy)
    return new Map([...acc, [name, (acc.get(name) ?? 0) + 1]])
  }, new Map<string, number>())
}

function computeSimpleGroups(
  records: readonly Readonly<Record<string, unknown>>[],
  groupBy: string
): readonly { readonly name: string; readonly count: number }[] {
  return Array.from(computeGroupCounts(records, groupBy).entries()).map(([name, count]) => ({
    name,
    count,
  }))
}

function computeListRecordsAggregationBlock(params: {
  readonly repo: TableRepository['Type']
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly records: readonly Readonly<Record<string, unknown>>[]
  readonly filter?: ListRecordsConfig['filter']
  readonly includeDeleted?: boolean
  readonly aggregate: AggregateConfig
  readonly groupBy?: string
}) {
  return Effect.gen(function* () {
    const { repo, session, tableName, records, filter, includeDeleted, aggregate, groupBy } = params
    if (groupBy) {
      const aggregated = computeGroupedAggregations(records, groupBy, aggregate)
      const counts = computeGroupCounts(records, groupBy)
      const withCount = aggregated.map((g) => ({
        name: g.name,
        count: counts.get(g.name) ?? 0,
        aggregations: g.aggregations,
      }))
      return { groups: withCount }
    }
    const raw = yield* repo.computeAggregations({
      session,
      tableName,
      filter,
      includeDeleted,
      aggregate,
    })
    const aggregations = aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw
    return { aggregations }
  })
}

export function createListRecordsProgram(
  config: ListRecordsConfig
): Effect.Effect<ListRecordsResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, app, userRole, filter, includeDeleted, aggregate, groupBy } = config
    const { format, timezone, sort, fields, limit, offset } = config

    const records = yield* repo.listRecords({ session, tableName, filter, includeDeleted, sort })
    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
      format,
      timezone,
      fields,
    })
    const enrichedProcessed = enrichRecordsWithAttachmentUrls(processedRecords, {
      app,
      tableName,
      origin: config.origin ?? '',
    })
    const { paginatedRecords, pagination } = applyPagination(
      enrichedProcessed,
      records.length,
      limit,
      offset
    )

    const aggBlock = aggregate
      ? yield* computeListRecordsAggregationBlock({
          repo,
          session,
          tableName,
          records,
          filter,
          includeDeleted,
          aggregate,
          groupBy,
        })
      : {}

    const simpleGroupsBlock =
      groupBy && !aggregate ? { groups: computeSimpleGroups(records, groupBy) } : {}

    return {
      records: [...paginatedRecords] as TransformedRecord[],
      pagination,
      ...aggBlock,
      ...simpleGroupsBlock,
    } as unknown as ListRecordsResponse
  })
}

interface ListTrashConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly sort?: string
  readonly limit?: number
  readonly offset?: number
}

function extractDeletedByUserId(rawRecord: Readonly<Record<string, unknown>>): string | undefined {
  const deletedByUser = rawRecord['deleted_by_user']
  if (!deletedByUser || typeof deletedByUser !== 'object') return undefined
  const userObj = deletedByUser as Record<string, unknown>
  if (!userObj['id']) return undefined
  return String(userObj['id'])
}

export function createListTrashProgram(
  config: ListTrashConfig
): Effect.Effect<ListRecordsResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, app, userRole, filter, sort, limit, offset } = config

    const records = yield* repo.listTrash({ session, tableName, filter, sort })

    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
    })

    const recordsWithPreservedIds = processedRecords.map((record) => {
      const rawRecord = records.find((r) => String(r.id) === String(record.id))
      const originalId = rawRecord?.id
      const id = typeof originalId === 'number' ? originalId : record.id

      const deletedBy = rawRecord ? extractDeletedByUserId(rawRecord) : undefined

      return {
        ...record,
        id,
        ...(deletedBy ? { deletedBy } : {}),
      }
    })

    const { paginatedRecords, pagination } = applyPagination(
      recordsWithPreservedIds,
      records.length,
      limit,
      offset
    )

    return {
      records: [...paginatedRecords] as TransformedRecord[],
      pagination,
    }
  })
}

interface GetRecordConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userRole: string
  readonly includeDeleted?: boolean
  readonly format?: 'display'
  readonly origin?: string
}

export function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<GetRecordResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, recordId, app, userRole, includeDeleted } = config

    const record = yield* repo.getRecord(session, tableName, recordId, includeDeleted)
    if (!record) return yield* Effect.fail(new SessionContextError('Record not found'))

    const filteredRecord = filterReadableFields({ app, tableName, userRole, record })
    const transformedRaw = transformRecord(filteredRecord, {
      app,
      tableName,
      format: config.format,
    })
    const transformed = enrichRecordWithAttachmentUrls(transformedRaw, {
      app,
      tableName,
      origin: config.origin ?? '',
    })

    const fields =
      config.format === 'display'
        ? Object.fromEntries(
            Object.entries(transformed.fields).map(([k, v]) => {
              const isObj = typeof v === 'object' && v !== null && !Array.isArray(v)
              if (isObj && 'displayValue' in (v as object))
                return [k, (v as { displayValue: string }).displayValue]
              const r = formatFieldForDisplay({ fieldName: k, value: v, app, tableName })
              return [k, r ? r.displayValue : v]
            })
          )
        : transformed.fields

    const id = preserveIdType(record.id)

    return {
      ...fields,
      id,
      fields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  })
}

interface CreateRecordConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  readonly userRole?: string
  readonly origin?: string
}

export function createRecordProgram(config: CreateRecordConfig) {
  const { session, tableName, fields, app, userRole, origin } = config
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    const record = yield* repo.createRecord(session, tableName, fields)

    const enrich = (rec: TransformedRecord): TransformedRecord =>
      enrichRecordWithAttachmentUrls(rec, { app, tableName, origin: origin ?? '' })

    const transformed = enrich(transformRecord(record, app ? { app, tableName } : undefined))

    const filteredFields =
      app && userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app,
              tableName,
              userRole,
              record,
            })

            const transformedFiltered = enrich(transformRecord(filteredRecord, { app, tableName }))
            return transformedFiltered.fields
          })()
        : transformed.fields

    return {
      ...filteredFields,
      id: transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  })
}

export function updateRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
    readonly userRole?: string
  }
) {
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    const record = yield* repo.updateRecord(session, tableName, recordId, {
      fields: params.fields,
      app: params.app,
    })

    const transformed = transformRecord(record, { app: params.app, tableName })

    const filteredFields =
      params.app && params.userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app: params.app!,
              tableName,
              userRole: params.userRole!,
              record,
            })

            const transformedFiltered = transformRecord(filteredRecord, {
              app: params.app,
              tableName,
            })
            return transformedFiltered.fields
          })()
        : transformed.fields

    const originalId = record.id
    return {
      ...filteredFields,
      id: typeof originalId === 'number' ? originalId : transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  })
}

export function restoreRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<RestoreRecordResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const record = yield* repo.restoreRecord(session, tableName, recordId)
    if (record && '_error' in record && record._error === 'not_deleted')
      return yield* Effect.fail(new SessionContextError('Record is not deleted'))
    if (!record) return yield* Effect.fail(new SessionContextError('Record not found'))
    return { success: true as const, record: transformRecord(record) }
  })
}

export function rawGetRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.getRecord(session, tableName, recordId)
  })
}

export function deleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  app?: App
): Effect.Effect<
  { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
  SessionContextError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.deleteRecord(session, tableName, recordId, app)
  })
}

export function permanentlyDeleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.permanentlyDeleteRecord(session, tableName, recordId)
  })
}
