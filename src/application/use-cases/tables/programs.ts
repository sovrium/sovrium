/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- tables/programs.ts is the single records-CRUD orchestration surface (list / get / create / update / delete / restore / batch / get-with-display). B-01 threaded the attachment URL enricher through 5 of those programs, adding +18 lines. Splitting per-program would lose the shared validation+transform composition. */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  buildAiComputeProjection,
  buildAiComputeProjections,
} from '@/application/use-cases/ai-compute/status-projection'
import { NotFoundError, ValidationError } from '@/domain/errors'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
} from '@/domain/services/authorship-fields'
import { isGuestSession } from '@/domain/services/guest-session'
import { filterReadableFields } from '@/domain/validators/field-read-filter'
import {
  computeGroupPartitions,
  reshapeShortcutAggregations,
  type AggregateConfig,
} from './utils/aggregation-helpers'
import {
  enrichRecordsWithAttachmentUrls,
  enrichRecordWithAttachmentUrls,
} from './utils/attachment-url-enricher'
import { formatFieldForDisplay } from './utils/display-formatter'
import { buildProjectionColumns } from './utils/field-projection'
import {
  processRecords,
  applyPagination,
  buildPaginationMeta,
  DEFAULT_PAGE_SIZE,
} from './utils/list-helpers'
import { getManyToManyFieldSpecs, type ManyToManyFieldSpec } from './utils/many-to-many-fields'
import { preserveIdType } from './utils/preserve-id-type'
import { transformRecord } from './utils/record-transformer'
import {
  buildRecordDisplayLabels,
  collectReferencedKeys,
  getRelationshipDisplaySpecs,
} from './utils/relationship-display-fields'
import type { TransformedRecord } from './utils/record-transformer'
import type { UserSession } from '@/application/ports/models/user-session'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type {
  ListRecordsResponse,
  GetRecordResponse,
  RestoreRecordResponse,
} from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

// Re-export from table-operations
export {
  TableNotFoundError,
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
  listViewsProgram,
  getViewProgram,
  getViewRecordsProgram,
} from './table-operations'

// Re-export from batch-operations
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
  /**
   * Absolute origin (e.g. `http://127.0.0.1:3000`) of the incoming request.
   * Threaded through so `'attachment'` field values can be decorated with
   * absolute signed-download URLs that round-trip against the same server
   * (B-01). Empty string falls back to root-relative URLs.
   */
  readonly origin?: string
}

/**
 * The grouping levels a `?groupBy=` names, outermost first.
 *
 * One field is the whole parameter as it has always been; a comma-separated list
 * names the nested levels beneath it (`region,stage,owner`). Blank entries are
 * dropped so a trailing comma degrades to the levels that were actually named
 * rather than partitioning on a field called `''`.
 */
function parseGroupByLevels(groupBy: string | undefined): readonly string[] {
  if (!groupBy) return []
  return groupBy
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0)
}

function computeListRecordsAggregationBlock(params: {
  readonly repo: TableRepository['Service']
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
    const raw = yield* repo.computeAggregations({
      session,
      tableName,
      filter,
      includeDeleted,
      aggregate,
    })
    const aggregations = aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw
    // Grouping and aggregating are two questions about the same view, not two
    // modes: a grid that both groups its rows AND summarises a column asks both
    // in one request (five shipped templates do). Answering only the grouped one
    // would have blanked those summary footers the moment the grid started
    // sending `?groupBy=`, so both blocks are returned.
    const levels = parseGroupByLevels(groupBy)
    if (levels.length > 0) {
      return { groups: computeGroupPartitions(records, levels, aggregate), aggregations }
    }
    return { aggregations }
  })
}

// ── [internal ref]: many-to-many field split (create) + read enrichment ──────────────

type ManyToManyWriteLink = {
  readonly relatedTable: string
  readonly relatedIds: readonly (string | number)[]
  readonly hasReciprocal: boolean
}

/** The junction map `recordId -> fieldName -> relatedIds` (records with no links absent). */
type ManyToManyLinkMap = Record<string, Record<string, readonly (string | number)[]>>

/**
 * Split a create payload into base-column fields and many-to-many write links.
 * A many-to-many field has no base column, so it must be removed from the
 * INSERT and its ids written to the junction table instead.
 */
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

/**
 * The many-to-many fields a read should resolve, honouring a `?fields=`
 * selection.
 *
 * A many-to-many column has no base column, so it survives `applyFieldSelection`
 * by not being there at all and is then re-injected from the table's DECLARED
 * specs. Left unfiltered that is a selection bypass: `?fields=title` came back
 * carrying `tags` because the enrichment never consulted the requested list.
 *
 * The intersection runs only when a selection is present — an absent `fields`
 * still means "every column", junction-backed ones included.
 */
const selectedManyToManySpecs = (
  app: App | undefined,
  tableName: string,
  fields: string | undefined
): readonly ManyToManyFieldSpec[] => {
  const specs = getManyToManyFieldSpecs(app?.tables, tableName)
  if (fields === undefined) return specs
  const requested = new Set(fields.split(',').map((name) => name.trim()))
  return specs.filter((spec) => requested.has(spec.fieldName))
}

/**
 * Resolve many-to-many field values from junction tables for a set of records.
 * No-op (empty map) when the table declares no many-to-many fields, or when a
 * field selection named none of them.
 */
const readManyToManyLinks = (
  app: App | undefined,
  tableName: string,
  ids: readonly (string | number)[],
  fields?: string
): Effect.Effect<ManyToManyLinkMap, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const specs = selectedManyToManySpecs(app, tableName, fields)
    if (specs.length === 0 || ids.length === 0) return {}
    const repo = yield* TableRepository
    return yield* repo.readManyToMany({
      sourceTable: tableName,
      sourceIds: ids,
      fields: specs.map((s) => ({ fieldName: s.fieldName, relatedTable: s.relatedTable })),
    })
  })

/**
 * Merge a record's resolved many-to-many arrays into its `fields` (no-op when
 * absent). Generic in the field value type `V` so the merge preserves the
 * caller's value typing instead of collapsing to `unknown`; the injected
 * many-to-many values are `readonly (string | number)[]` (a subtype of the
 * response field-value union), so the result stays assignable to it.
 */
const mergeManyToManyFields = <V>(
  fields: Readonly<Record<string, V>>,
  recordId: string | number,
  linkMap: Readonly<ManyToManyLinkMap>
): Readonly<Record<string, V | readonly (string | number)[]>> => {
  const links = linkMap[String(recordId)]
  return links ? { ...fields, ...links } : { ...fields }
}

/** Write a create's many-to-many junction rows (no-op when there are none). */
const writeManyToManyLinks = (
  repo: TableRepository['Service'],
  tableName: string,
  sourceId: string | number,
  links: readonly ManyToManyWriteLink[]
): Effect.Effect<void, DatabaseError> =>
  links.length === 0
    ? Effect.void
    : repo.linkManyToMany({ sourceTable: tableName, sourceId, links })

/** Enrich a page of records with their many-to-many field values from junctions. */
const enrichRecordsWithManyToMany = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[],
  fields?: string
): Effect.Effect<readonly TransformedRecord[], DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const linkMap = yield* readManyToManyLinks(
      app,
      tableName,
      records.map((r) => r.id),
      fields
    )
    return records.map(
      (record) =>
        ({
          ...record,
          fields: mergeManyToManyFields(record.fields, record.id, linkMap),
        }) as TransformedRecord
    )
  })

/**
 * Attach the `_display` label block to a page of records.
 *
 * Runs AFTER the many-to-many enrich, because a many-to-many column has no base
 * column — its keys only exist on the record once the junction has been read,
 * and a to-many relationship is exactly the case a read surface most needs
 * labelled.
 *
 * The stored keys are untouched: `_display` sits beside `fields`, so a caller
 * that wants the identifier still finds it where it always was.
 */
const enrichRecordsWithRelatedLabels = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[]
): Effect.Effect<readonly TransformedRecord[], DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const specs = getRelationshipDisplaySpecs(app?.tables, tableName)
    if (specs.length === 0 || records.length === 0) return records
    const requests = collectReferencedKeys(specs, records)
    if (requests.length === 0) return records
    const repo = yield* TableRepository
    const labels = yield* repo.readRelatedLabels(requests)
    return records.map((record) => {
      const display = buildRecordDisplayLabels(specs, record.fields, labels)
      return (display ? { ...record, _display: display } : record) as TransformedRecord
    })
  })

/**
 * Build the response page of records: `processRecords` → attachment-url enrich
 * (B-01) → paginate → many-to-many enrich → relationship labels.
 * Extracted so `createListRecordsProgram` stays under the per-function line
 * budget.
 *
 * `page.total` is passed in rather than read off `records.length` because the
 * two stop agreeing under SQL pushdown: `records` is then ONE window and the
 * count comes from a separate `COUNT(*)` over the same filter.
 *
 * `page.preSliced` says the engine already cut the window. Slicing it again
 * with the same offset is the defect this flag exists to prevent — page 1
 * (offset 0) would stay perfect while every later page silently returned
 * nothing.
 */
const buildRecordPage = (
  config: ListRecordsConfig,
  records: readonly Record<string, unknown>[],
  page: { readonly total: number; readonly preSliced: boolean }
) =>
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
    // B-01: decorate `'attachment'` JSONB field values with signedUrl /
    // signedUrlExpiresAt (private buckets) or a direct `url` (public buckets).
    const enriched = enrichRecordsWithAttachmentUrls(processed, {
      app: config.app,
      tableName: config.tableName,
      origin: config.origin ?? '',
    })
    const pagination = buildPaginationMeta(page.total, config.limit, config.offset)
    const paginatedRecords = page.preSliced
      ? enriched
      : enriched.slice(pagination.offset, pagination.offset + pagination.limit)
    const withM2m = yield* enrichRecordsWithManyToMany(
      config.app,
      config.tableName,
      paginatedRecords,
      config.fields
    )
    // Labels for every relationship column that declared one. Enriched after
    // pagination and after the junction read, so the lookup covers ONE page of
    // keys and can see the many-to-many values it needs to label.
    const withLabels = yield* enrichRecordsWithRelatedLabels(config.app, config.tableName, withM2m)
    // [internal ref] Phase 2: the same gated `_aiCompute` block the single-record read
    // carries. Enriched AFTER pagination, so the status read covers ONE page of
    // ids rather than the whole result set — and gated on the table declaring an
    // AI-compute field at all, so a table with none never touches the status
    // table and pays nothing for this.
    const aiComputeByRecord = yield* buildAiComputeProjections(
      config.app,
      config.tableName,
      withLabels.map((record) => record.id)
    )
    if (aiComputeByRecord.size === 0) return { records: withLabels, pagination }
    const withAiCompute = withLabels.map((record) => {
      const aiCompute = aiComputeByRecord.get(String(record.id))
      return (aiCompute ? { ...record, _aiCompute: aiCompute } : record) as TransformedRecord
    })
    return { records: withAiCompute, pagination }
  })

/**
 * How many rows match a list request, independent of the page it asked for.
 *
 * Under SQL pushdown the returned array is one window, so `records.length` no
 * longer answers `pagination.total`. `computeAggregations` already emits
 * `SELECT COUNT(*) … WHERE …` through the exact same filter and soft-delete
 * clause the listing uses, so the count and the page cannot describe different
 * row sets — which is why this reuses it instead of adding a second count query
 * with its own copy of the WHERE builder.
 *
 * A count that fails to parse falls back to the page length rather than to 0:
 * under-reporting a total is a wrong answer, but reporting zero rows on a
 * response that visibly carries some is a self-contradicting one.
 */
const countMatchingRecords = (
  repo: TableRepository['Service'],
  params: {
    readonly session: Readonly<UserSession>
    readonly tableName: string
    readonly filter?: QueryFilter
    readonly includeDeleted?: boolean
  },
  fallback: number
): Effect.Effect<number, DatabaseError> =>
  Effect.gen(function* () {
    const result = yield* repo.computeAggregations({ ...params, aggregate: { count: true } })
    const total = Number(result.count)
    return Number.isFinite(total) ? total : fallback
  })

/**
 * Read the rows a list request needs, and say how many matched overall.
 *
 * Two routes, chosen by whether the request GROUPS:
 *
 *   - `groupBy` absent → `LIMIT`/`OFFSET` are pushed into SQL and `total` comes
 *     from a separate `COUNT(*)` over the same filter. `preSliced` is then true
 *     and nothing downstream may slice again.
 *   - `groupBy` present → the whole result set is fetched, because
 *     `computeGroupPartitions` partitions the raw array in memory. Paging in SQL
 *     would silently group ONE page: three status groups summing to 24 would come
 *     back as whatever happened to land in the first five rows, with no error.
 *
 * Pushing `limit ?? DEFAULT_PAGE_SIZE` rather than a bare `limit` is
 * load-bearing on both counts — an absent limit would otherwise fetch the whole
 * table, and an `OFFSET` with no `LIMIT` beside it is a syntax error on SQLite.
 */
const readListRows = (config: ListRecordsConfig, repo: TableRepository['Service']) =>
  Effect.gen(function* () {
    const { session, tableName, filter, includeDeleted, groupBy } = config
    const preSliced = groupBy === undefined
    const records = yield* repo.listRecords({
      session,
      tableName,
      filter,
      includeDeleted,
      sort: config.sort,
      ...(preSliced ? { limit: config.limit ?? DEFAULT_PAGE_SIZE, offset: config.offset } : {}),
      columns: buildProjectionColumns({
        app: config.app,
        tableName,
        fields: config.fields,
        groupBy,
      }),
    })
    const total = preSliced
      ? yield* countMatchingRecords(
          repo,
          { session, tableName, filter, includeDeleted },
          records.length
        )
      : records.length
    return { records, total, preSliced }
  })

export function createListRecordsProgram(
  config: ListRecordsConfig
): Effect.Effect<ListRecordsResponse, DatabaseError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, filter, includeDeleted, aggregate, groupBy } = config

    const { records, total, preSliced } = yield* readListRows(config, repo)
    const { records: pageRecords, pagination } = yield* buildRecordPage(config, records, {
      total,
      preSliced,
    })

    // `records` is ONE PAGE whenever `preSliced` is true — safe to hand on here
    // only because both consumers below are gated on `groupBy`, which is exactly
    // the condition that turns the pushdown off.
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

    // When groupBy is specified without aggregate, compute name/count groups only
    const simpleGroupsBlock =
      groupBy && !aggregate
        ? { groups: computeGroupPartitions(records, parseGroupByLevels(groupBy)) }
        : {}

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

/**
 * Extract deletedBy user ID from a raw trash record.
 * The listTrash query joins auth.user and returns deleted_by_user object.
 * We extract only the user ID string to match the flat authorship format.
 */
function extractDeletedByUserId(rawRecord: Readonly<Record<string, unknown>>): string | undefined {
  const deletedByUser = rawRecord['deleted_by_user']
  if (!deletedByUser || typeof deletedByUser !== 'object') return undefined
  const userObj = deletedByUser as Record<string, unknown>
  if (!userObj['id']) return undefined
  return String(userObj['id'])
}

export function createListTrashProgram(
  config: ListTrashConfig
): Effect.Effect<ListRecordsResponse, DatabaseError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, app, userRole, filter, sort, limit, offset } = config

    // Query soft-deleted records with session context (RLS policies apply automatically)
    const records = yield* repo.listTrash({ session, tableName, filter, sort })

    // Process records (field-level filtering, transformations)
    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
    })

    // Preserve numeric IDs and attach deletedBy user object from joined query results
    const recordsWithPreservedIds = processedRecords.map((record) => {
      // Try to parse ID as number if it's a numeric string, otherwise keep as-is
      const rawRecord = records.find((r) => String(r.id) === String(record.id))
      const originalId = rawRecord?.id
      const id = typeof originalId === 'number' ? originalId : record.id

      // Extract deletedBy user ID from the raw record's join result
      const deletedBy = rawRecord ? extractDeletedByUserId(rawRecord) : undefined

      return {
        ...record,
        id,
        ...(deletedBy ? { deletedBy } : {}),
      }
    })

    // Apply pagination
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
  /** See {@link ListRecordsConfig.timezone}. */
  readonly timezone?: string
  /** See {@link ListRecordsConfig.origin}. */
  readonly origin?: string
}

/**
 * Collapse the single-record read's fields to FLAT display strings.
 *
 * The list route keeps the `{ value, displayValue, timezone }` object; this
 * route deliberately does not, and nine sibling `format=display` specs read
 * `fields.X` as a string. Changing that here would silently re-spec a contract
 * they pin, so the collapse stays.
 *
 * Two paths reach a display string, and BOTH need the caller's zone.
 * `transformRecord` has already formatted every field it recognised, leaving an
 * object to unwrap; anything it passed through unformatted is formatted here
 * instead. Passing the override to only one of them made the rendered clock
 * depend on which branch a field happened to take.
 */
const toDisplayFields = (
  fields: Readonly<TransformedRecord['fields']>,
  config: GetRecordConfig
): Readonly<TransformedRecord['fields']> =>
  Object.fromEntries(
    Object.entries(fields).map(
      ([key, value]): readonly [string, TransformedRecord['fields'][string]] => {
        const isObj = typeof value === 'object' && value !== null && !Array.isArray(value)
        if (isObj && 'displayValue' in (value as object)) {
          return [key, (value as { displayValue: string }).displayValue]
        }
        const formatted = formatFieldForDisplay({
          fieldName: key,
          value,
          app: config.app,
          tableName: config.tableName,
          timezoneOverride: config.timezone,
        })
        return [key, formatted ? formatted.displayValue : value]
      }
    )
  )

export function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<GetRecordResponse, DatabaseError | NotFoundError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, recordId, app, userRole, includeDeleted } = config

    const record = yield* repo.getRecord(session, tableName, recordId, includeDeleted)
    if (!record) return yield* Effect.fail(new NotFoundError('Record not found'))

    const filteredRecord = filterReadableFields({ app, tableName, userRole, record })
    const transformedRaw = transformRecord(filteredRecord, {
      app,
      tableName,
      format: config.format,
      timezone: config.timezone,
    })
    // B-01: same attachment-URL enrichment as the list path.
    const transformed = enrichRecordWithAttachmentUrls(transformedRaw, {
      app,
      tableName,
      origin: config.origin ?? '',
    })

    const fields =
      config.format === 'display' ? toDisplayFields(transformed.fields, config) : transformed.fields

    // Preserve TEXT primary keys (e.g. scope tables in `auth.scopeTables`)
    // as strings; only coerce when the value *looks* numeric. Avoids NaN
    // for opaque string ids.
    const id = preserveIdType(record.id)

    // [internal ref]: resolve many-to-many relationship fields from their junction
    // tables (they have no base column, so `SELECT *` never returns them). A
    // record with no links leaves the field absent — no empty-array injection.
    const m2mLinks = yield* readManyToManyLinks(app, tableName, [id])
    const enrichedFields = mergeManyToManyFields(fields, id, m2mLinks)

    // [internal ref] Phase 2: surface the AI-compute refinement signal as a gated
    // top-level `_aiCompute` block. `undefined` (omitted) for non-AI tables
    // and for records with no status rows yet — non-AI tables skip the read.
    const aiCompute = yield* buildAiComputeProjection(app, tableName, id)

    // Spread fields at root level as flat aliases (same pattern as createRecordProgram).
    // Lets callers access record.fieldName in addition to record.fields.fieldName.
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
  /** See {@link ListRecordsConfig.origin}. */
  readonly origin?: string
}

/**
 * GAP-16: stamp every `created-by`/`updated-by`-typed column BY NAME with the
 * authenticated actor. The infra authorship injection only fills the LITERAL
 * `created_by`/`updated_by` columns (discovered via DB introspection); a
 * custom-named field (e.g. `author`, generated TEXT NOT NULL under auth) would
 * otherwise be left NULL and 500 the INSERT. Resolving by FIELD TYPE here (the
 * application layer, where the table schema is available) mirrors
 * `writeBoundTableRecord` in submit-form.ts.
 *
 * `phase: 'create'` stamps both created-by AND updated-by fields (a fresh row
 * is created-and-last-modified by the same actor); `phase: 'update'` re-stamps
 * only updated-by fields. Guest sessions are skipped — no real actor exists to
 * stamp a custom-named field, and the infra normalizes the literal columns to
 * NULL. On create, the literal `created_by` is still re-overridden downstream
 * by the infra, so the AUTHORSHIP-013 contract (user-supplied value ignored)
 * is preserved.
 */
const applyAuthorshipOverrides = (input: {
  readonly phase: 'create' | 'update'
  readonly fields: Readonly<Record<string, unknown>>
  readonly tables: App['tables'] | undefined
  readonly tableName: string
  readonly userId: string
}): Readonly<Record<string, unknown>> => {
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

    // GAP-16: see applyAuthorshipOverrides.
    const fieldsWithAuthorship = applyAuthorshipOverrides({
      phase: 'create',
      fields,
      tables: app?.tables,
      tableName,
      userId: session.userId,
    })

    // [internal ref]: a many-to-many relationship field has no base column — split it
    // out of the base INSERT (it would try to write a phantom column → 500) and
    // write the junction rows after the base row (real id) is created.
    const { baseFields, links } = splitManyToManyFields(
      fieldsWithAuthorship,
      getManyToManyFieldSpecs(app?.tables, tableName)
    )

    // Create record with session context
    const record = yield* repo.createRecord(session, tableName, baseFields)
    yield* writeManyToManyLinks(repo, tableName, record.id as string | number, links)

    // B-01: enrich attachment fields with signedUrl / url on the create-record
    // response so callers see the same shape they get back on GET / LIST.
    const enrich = (rec: TransformedRecord): TransformedRecord =>
      enrichRecordWithAttachmentUrls(rec, { app, tableName, origin: origin ?? '' })

    const transformed = enrich(transformRecord(record, app ? { app, tableName } : undefined))

    // Apply field-level read permissions filtering
    // If app and userRole are provided, filter fields based on permissions
    const filteredFields =
      app && userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app,
              tableName,
              userRole,
              record,
            })

            // Transform filtered record to get only user fields (exclude system fields)
            const transformedFiltered = enrich(transformRecord(filteredRecord, { app, tableName }))
            return transformedFiltered.fields
          })()
        : transformed.fields

    // Return in format expected by tests: system fields at root, user fields
    // both nested (canonical) and at the root (flat alias). The flat alias
    // supports specs that read `record.file` instead of `record.fields.file`.
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

/**
 * [internal ref] (update): resolve the base row for an update while handling the
 * many-to-many split. A `many-to-many` relationship field has no base column, so
 * it is split OUT of the SET clause and its ids written to the junction table —
 * mirroring the create path. Without the split the field name reaches the base
 * UPDATE (no such column), the update matches nothing, and the route 404s.
 *
 * Updates the base columns when there is at least one to write; a pure m2m PATCH
 * (only relationship arrays) fetches the existing row instead so the junction
 * write targets a real record and the response reflects it. Returns `{}` when a
 * pure m2m PATCH targets a missing row (the caller surfaces that as a 404).
 * No-op split for tables/patches with no m2m field.
 */
const resolveUpdatedBaseRecord = (
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
    readonly userRole?: string
  }
): Effect.Effect<Record<string, unknown>, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const m2mSpecs = getManyToManyFieldSpecs(params.app?.tables, tableName)
    const { baseFields, links } = splitManyToManyFields(params.fields, m2mSpecs)

    // GAP-16: re-stamp every `updated-by`-typed column BY NAME with the updating
    // actor (created-by fields are never touched on update).
    const baseWithAuthorship = applyAuthorshipOverrides({
      phase: 'update',
      fields: baseFields,
      tables: params.app?.tables,
      tableName,
      userId: session.userId,
    })

    const record =
      Object.keys(baseWithAuthorship).length > 0
        ? yield* repo.updateRecord(session, tableName, recordId, {
            fields: baseWithAuthorship,
            app: params.app,
          })
        : ((yield* repo.getRecord(session, tableName, recordId)) ?? {})

    if (Object.keys(record).length === 0) return {}

    // Write the m2m junction rows (idempotent add semantics).
    yield* writeManyToManyLinks(repo, tableName, record.id as string | number, links)
    return record
  })

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
    // [internal ref] (update): resolve the base row, handling the many-to-many split +
    // junction write. Extracted so this generator stays under the complexity cap.
    const record = yield* resolveUpdatedBaseRecord(session, tableName, recordId, params)

    // Pure m2m PATCH against a missing row: surface empty so the route 404s.
    if (Object.keys(record).length === 0) return {}

    // Transform with app context to include table-specific fields like created_at/updated_at
    const transformed = transformRecord(record, { app: params.app, tableName })

    // Apply field-level read permissions filtering
    // If app and userRole are provided, filter fields based on permissions
    const filteredFields =
      params.app && params.userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app: params.app!,
              tableName,
              userRole: params.userRole!,
              record,
            })

            // Transform filtered record to get only user fields (exclude system fields)
            const transformedFiltered = transformRecord(filteredRecord, {
              app: params.app,
              tableName,
            })
            return transformedFiltered.fields
          })()
        : transformed.fields

    // Return in format expected by tests: system fields at root, user fields
    // both nested (canonical) and at the root (flat alias). Mirrors the
    // create-record response so PATCH and POST share the same envelope.
    // Preserve original ID type (number if it was number in database).
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
  recordId: string,
  params?: {
    readonly app?: App
    readonly userRole?: string
  }
): Effect.Effect<
  RestoreRecordResponse,
  DatabaseError | NotFoundError | ValidationError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const record = yield* repo.restoreRecord(session, tableName, recordId)
    // Special error marker for non-deleted records (vs. missing rows).
    if (record && '_error' in record && record._error === 'not_deleted')
      return yield* Effect.fail(new ValidationError('Record is not deleted'))
    if (!record) return yield* Effect.fail(new NotFoundError('Record not found'))

    // The restore echo is a record-bearing response and must strip fields the
    // caller may not read, exactly like the GET/PATCH/POST echoes. The only
    // gate on this route is `permissions.delete`, so without this a role that
    // may restore a row but may not read one of its columns got that column
    // back in the echo. `restoreRecordProgram` previously took no `app` and no
    // `userRole` and therefore structurally could not filter. Its batch sibling
    // returns a count and has no such shape, which is why the leak survived.
    const { app, userRole } = params ?? {}
    const readable =
      app && userRole ? filterReadableFields({ app, tableName, userRole, record }) : record

    return {
      success: true as const,
      record: transformRecord(readable, app ? { app, tableName } : undefined),
    }
  })
}

/** Raw record retrieval (no permission filtering) — used for internal checks. */
export function rawGetRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, DatabaseError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.getRecord(session, tableName, recordId)
  })
}

/** Soft-delete a record. Wraps Infrastructure for layer architecture. */
export function deleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  app?: App
): Effect.Effect<
  { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
  DatabaseError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.deleteRecord(session, tableName, recordId, app)
  })
}

/** Permanently delete a record. Wraps Infrastructure for layer architecture. */
export function permanentlyDeleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, DatabaseError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.permanentlyDeleteRecord(session, tableName, recordId)
  })
}
