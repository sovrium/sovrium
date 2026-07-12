/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { buildAiComputeProjection } from '@/application/use-cases/ai-compute/status-projection'
import { SessionContextError } from '@/domain/errors'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/services/authorship-fields'
import { isGuestSession } from '@/domain/services/guest-session'
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
import { getManyToManyFieldSpecs, type ManyToManyFieldSpec } from './utils/many-to-many-fields'
import { preserveIdType } from './utils/preserve-id-type'
import { transformRecord } from './utils/record-transformer'
import type { TransformedRecord } from './utils/record-transformer'
import type { UserSession } from '@/application/ports/models/user-session'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
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
  readonly filter?: QueryFilter
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


type ManyToManyWriteLink = {
  readonly relatedTable: string
  readonly relatedIds: readonly (string | number)[]
  readonly hasReciprocal: boolean
}

type ManyToManyLinkMap = Record<string, Record<string, readonly (string | number)[]>>

const splitManyToManyFields = (
  fields: Readonly<Record<string, unknown>>,
  specs: readonly ManyToManyFieldSpec[]
): {
  readonly baseFields: Record<string, unknown>
  readonly links: readonly ManyToManyWriteLink[]
} => {
  const names = new Set(specs.map((s) => s.fieldName))
  const baseFields = Object.fromEntries(Object.entries(fields).filter(([key]) => !names.has(key)))
  const links = specs
    .map((spec) => {
      const raw = fields[spec.fieldName]
      const relatedIds =
        raw === undefined || raw === null
          ? []
          : Array.isArray(raw)
            ? (raw as (string | number)[])
            : [raw as string | number]
      return { relatedTable: spec.relatedTable, relatedIds, hasReciprocal: spec.hasReciprocal }
    })
    .filter((link) => link.relatedIds.length > 0)
  return { baseFields, links }
}

const readManyToManyLinks = (
  app: App | undefined,
  tableName: string,
  ids: readonly (string | number)[]
): Effect.Effect<ManyToManyLinkMap, SessionContextError, TableRepository> =>
  Effect.gen(function* () {
    const specs = getManyToManyFieldSpecs(app?.tables, tableName)
    if (specs.length === 0 || ids.length === 0) return {}
    const repo = yield* TableRepository
    return yield* repo.readManyToMany({
      sourceTable: tableName,
      sourceIds: ids,
      fields: specs.map((s) => ({ fieldName: s.fieldName, relatedTable: s.relatedTable })),
    })
  })

const mergeManyToManyFields = <V>(
  fields: Readonly<Record<string, V>>,
  recordId: string | number,
  linkMap: ManyToManyLinkMap
): Record<string, V | readonly (string | number)[]> => {
  const links = linkMap[String(recordId)]
  return links ? { ...fields, ...links } : { ...fields }
}

const writeManyToManyLinks = (
  repo: TableRepository['Type'],
  tableName: string,
  sourceId: string | number,
  links: readonly ManyToManyWriteLink[]
): Effect.Effect<void, SessionContextError> =>
  links.length === 0
    ? Effect.void
    : repo.linkManyToMany({ sourceTable: tableName, sourceId, links })

const enrichRecordsWithManyToMany = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[]
): Effect.Effect<readonly TransformedRecord[], SessionContextError, TableRepository> =>
  Effect.gen(function* () {
    const linkMap = yield* readManyToManyLinks(
      app,
      tableName,
      records.map((r) => r.id)
    )
    return records.map(
      (record) =>
        ({
          ...record,
          fields: mergeManyToManyFields(record.fields, record.id, linkMap),
        }) as TransformedRecord
    )
  })

const buildRecordPage = (config: ListRecordsConfig, records: readonly Record<string, unknown>[]) =>
  Effect.gen(function* () {
    const processed = processRecords({
      records,
      app: config.app,
      tableName: config.tableName,
      userRole: config.userRole,
      format: config.format,
      timezone: config.timezone,
      fields: config.fields,
    })
    const enriched = enrichRecordsWithAttachmentUrls(processed, {
      app: config.app,
      tableName: config.tableName,
      origin: config.origin ?? '',
    })
    const { paginatedRecords, pagination } = applyPagination(
      enriched,
      records.length,
      config.limit,
      config.offset
    )
    const withM2m = yield* enrichRecordsWithManyToMany(
      config.app,
      config.tableName,
      paginatedRecords
    )
    return { records: withM2m, pagination }
  })

export function createListRecordsProgram(
  config: ListRecordsConfig
): Effect.Effect<ListRecordsResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, filter, includeDeleted, aggregate, groupBy } = config

    const records = yield* repo.listRecords({
      session,
      tableName,
      filter,
      includeDeleted,
      sort: config.sort,
    })
    const { records: pageRecords, pagination } = yield* buildRecordPage(config, records)

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
      records: [...pageRecords] as TransformedRecord[],
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
  readonly filter?: QueryFilter
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

    const m2mLinks = yield* readManyToManyLinks(app, tableName, [id])
    const enrichedFields = mergeManyToManyFields(fields, id, m2mLinks)

    const aiCompute = yield* buildAiComputeProjection(app, tableName, id)

    return {
      ...enrichedFields,
      id,
      fields: enrichedFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
      ...(aiCompute ? { _aiCompute: aiCompute } : {}),
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

const applyAuthorshipOverrides = (input: {
  readonly phase: 'create' | 'update'
  readonly fields: Readonly<Record<string, unknown>>
  readonly tables: App['tables'] | undefined
  readonly tableName: string
  readonly userId: string
}): Record<string, unknown> => {
  const { phase, fields, tables, tableName, userId } = input
  if (isGuestSession(userId)) return { ...fields }
  const overrides =
    phase === 'create'
      ? buildCreateAuthorshipOverrides(tables, tableName, userId)
      : buildUpdateAuthorshipOverrides(tables, tableName, userId)
  return { ...fields, ...overrides }
}

export function createRecordProgram(config: CreateRecordConfig) {
  const { session, tableName, fields, app, userRole, origin } = config
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    const fieldsWithAuthorship = applyAuthorshipOverrides({
      phase: 'create',
      fields,
      tables: app?.tables,
      tableName,
      userId: session.userId,
    })

    const { baseFields, links } = splitManyToManyFields(
      fieldsWithAuthorship,
      getManyToManyFieldSpecs(app?.tables, tableName)
    )

    const record = yield* repo.createRecord(session, tableName, baseFields)
    yield* writeManyToManyLinks(repo, tableName, record.id as string | number, links)

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
      fields: applyAuthorshipOverrides({
        phase: 'update',
        fields: params.fields,
        tables: params.app?.tables,
        tableName,
        userId: session.userId,
      }),
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
