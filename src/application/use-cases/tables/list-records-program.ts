/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The paged record read — `GET /api/tables/:table/records`, and the one program
 * in the package that answers a QUESTION ABOUT A SET rather than about a row.
 *
 * That is the seam. Every other program here addresses one record by id; this
 * one is a query, and the whole of its difficulty is that four things must
 * agree about which rows they are describing — the page, the total, the
 * aggregations and the groups. Three of the helpers below exist only to keep
 * them agreeing:
 *
 *   - {@link readListRows} chooses between SQL pushdown and a whole-set read,
 *     and reports which it used as `preSliced` so nothing downstream slices a
 *     window twice.
 *   - {@link countMatchingRecords} takes the total from the SAME filter the
 *     page used, rather than from `records.length`, which stops answering the
 *     moment the engine returns one window.
 *   - {@link buildRecordPage} runs the enrichment ladder in the ONE order that
 *     works, and does it after pagination so each enricher covers one page.
 *
 * The many-to-many and related-label enrichers it calls live in
 * `record-link-enrichment.ts`, shared with the single-record read and the two
 * write programs.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { buildAiComputeProjections } from '@/application/use-cases/ai-compute/status-projection'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { asMinMaxAnswer, minMaxKindOf } from '@/domain/models/app/tables/min-max-order-service'
import {
  answerOrderedAggregations,
  computeGroupPartitions,
  reshapeShortcutAggregations,
  type AggregateConfig,
  type OrderedAnswer,
} from './aggregation-helpers'
import { enrichRecordsWithAttachmentUrls } from './attachment-url-enricher'
import { buildProjectionColumns } from './field-projection'
import {
  omitHiddenColumnLookups,
  omitHiddenRecordLookups,
  withLookupKeyColumns,
} from './hidden-lookup-omission'
import { processRecords, buildPaginationMeta, DEFAULT_PAGE_SIZE } from './list-helpers'
import { lookupReadMasks } from './lookup-read-masks'
import {
  enrichRecordsWithManyToMany,
  enrichRecordsWithRelatedLabels,
} from './record-link-enrichment'
import { serializeDriverRow, type TransformedRecord } from './record-transformer'
import type { RequestedLabel } from './relationship-display-fields'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  LookupReadMask,
  QueryFilter,
} from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { ListRecordsResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

interface ListRecordsConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  /**
   * Group names the caller belongs to (un-prefixed). Read by the relationship
   * labels, which are shown only to a reader who may read the related column —
   * a `group:<name>` grant there has to be matched like it is on a direct read.
   */
  readonly userGroups?: readonly string[]
  /** `?labels=` — relationship labels a page column asked for (see `_display`). */
  readonly labels?: readonly RequestedLabel[]
  readonly filter?: QueryFilter
  readonly includeDeleted?: boolean
  readonly format?: 'display'
  readonly timezone?: string
  readonly sort?: string
  /**
   * Order a single-select by its DECLARED option order rather than by value.
   *
   * The view-records route has always sorted this way (a view sorted by
   * `priority: desc` lists high, medium, low), while the records list sorts by
   * value — and the repository port keeps the two apart on purpose (see its
   * `primaryKey` doc). So it is a switch the caller turns on, not a default.
   */
  readonly sortByOptionOrder?: boolean
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
  readonly lookupMasks: readonly LookupReadMask[]
  readonly app: ListRecordsConfig['app']
}) {
  return Effect.gen(function* () {
    const { repo, session, tableName, records, filter, includeDeleted, aggregate, groupBy } = params
    const computed = yield* repo.computeAggregations({
      session,
      tableName,
      filter,
      includeDeleted,
      aggregate,
      lookupMasks: params.lookupMasks,
    })
    // A `min`/`max` over a date answers as the records API reads the date.
    const answer: OrderedAnswer = (field, value) =>
      asMinMaxAnswer(minMaxKindOf(params.app, tableName, field), value)
    const raw = answerOrderedAggregations(computed, answer)
    const aggregations = aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw
    // Grouping and aggregating are two questions about the same view, not two
    // modes: a grid that both groups its rows AND summarises a column asks both
    // in one request (five shipped templates do). Answering only the grouped one
    // would have blanked those summary footers the moment the grid started
    // sending `?groupBy=`, so both blocks are returned.
    const levels = parseGroupByLevels(groupBy)
    if (levels.length > 0) {
      // A group is named by the value as the records API reads it: a date as
      // its day, a timestamp as its ISO instant — never a driver `Date`'s text.
      const readable = records.map((row) => serializeDriverRow(row, { app: params.app, tableName }))
      return { groups: computeGroupPartitions(readable, levels, aggregate, answer), aggregations }
    }
    return { aggregations }
  })
}

/** The many-to-many read of a page: the fields asked for, narrowed to what this reader may read. */
const linkReadOptions = (config: ListRecordsConfig) => ({
  fields: config.fields,
  reader: { session: config.session, role: config.userRole, groups: config.userGroups ?? [] },
})

/**
 * A page with its many-to-many links resolved, then every lookup
 * through such a link to a row the reader may not read left out — lookups
 * through a key column were judged on the raw rows.
 */
const withReadableLinks = (config: ListRecordsConfig, records: readonly TransformedRecord[]) =>
  enrichRecordsWithManyToMany(config.app, config.tableName, records, linkReadOptions(config)).pipe(
    Effect.flatMap((page) =>
      omitHiddenRecordLookups(config.app, config.tableName, page, linkReadOptions(config).reader)
    )
  )

/** Who the relationship labels are resolved for, and which ones the request asked for. */
const labelAudience = (config: ListRecordsConfig) => ({
  reader: {
    role: config.userRole,
    groups: config.userGroups ?? [],
    signedOut: isGuestSession(config.session.userId),
  },
  requested: config.labels ?? [],
  linkReader: linkReadOptions(config).reader,
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
      userGroups: config.userGroups ?? [],
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
    const withM2m = yield* withReadableLinks(config, paginatedRecords)
    // Labels for every relationship column that declared one — or that the
    // request asked for — narrowed to what this reader may read. Enriched after
    // pagination and after the junction read, so the lookup covers ONE page of
    // keys and can see the many-to-many values it needs to label.
    const withLabels = yield* enrichRecordsWithRelatedLabels(
      config.app,
      config.tableName,
      withM2m,
      labelAudience(config)
    )
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
    readonly lookupMasks: readonly LookupReadMask[]
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
    // A lookup the query steers on is evaluated as empty where its linked
    // record is hidden from this reader — in the page, the count, the
    // aggregates and the group names.
    const lookupMasks = yield* lookupReadMasks(
      config.app,
      tableName,
      linkReadOptions(config).reader,
      {
        filter,
        sort: config.sort,
        aggregate: config.aggregate as Readonly<Record<string, unknown>> | undefined,
        groupBy,
      }
    )
    const primaryKey = config.app.tables?.find((t) => t.name === tableName)?.primaryKey
    const preSliced = groupBy === undefined
    const records = yield* repo.listRecords({
      session,
      tableName,
      filter,
      includeDeleted,
      lookupMasks,
      sort: config.sort,
      ...(config.sortByOptionOrder === true && { app: config.app }),
      ...(preSliced ? { limit: config.limit ?? DEFAULT_PAGE_SIZE, offset: config.offset } : {}),
      columns: buildProjectionColumns({
        app: config.app,
        tableName,
        // A selected lookup brings its key, so it can be judged below.
        fields: withLookupKeyColumns(config.app, tableName, config.fields),
        groupBy,
      }),
      // The default sort key for a request that supplied no `sort`. A table
      // keyed on a composite of its own columns has no `id` column, so the
      // repository cannot assume one — see the port's doc on this field.
      ...(primaryKey ? { primaryKey } : {}),
    })
    const total = preSliced
      ? yield* countMatchingRecords(
          repo,
          { session, tableName, filter, includeDeleted, lookupMasks },
          records.length
        )
      : records.length
    return { records, total, preSliced, lookupMasks }
  })

export function createListRecordsProgram(
  config: ListRecordsConfig
): Effect.Effect<
  ListRecordsResponse,
  DatabaseError,
  TableRepository | AuthRepository | DataSourceRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, filter, includeDeleted, aggregate, groupBy } = config

    const { total, preSliced, lookupMasks, ...read } = yield* readListRows(config, repo)
    // On the RAW rows, before field permissions and `?fields=` can drop a
    // lookup's key — and before the groups below are keyed on its value.
    const { reader } = linkReadOptions(config)
    const records = yield* omitHiddenColumnLookups(config.app, tableName, read.records, reader)
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
          lookupMasks,
          app: config.app,
        })
      : {}

    // When groupBy is specified without aggregate, compute name/count groups only
    const simpleGroupsBlock =
      groupBy && !aggregate
        ? {
            groups: computeGroupPartitions(
              records.map((row) => serializeDriverRow(row, { app: config.app, tableName })),
              parseGroupByLevels(groupBy)
            ),
          }
        : {}

    return {
      records: [...pageRecords] as TransformedRecord[],
      pagination,
      ...aggBlock,
      ...simpleGroupsBlock,
    } as unknown as ListRecordsResponse
  }).pipe(Effect.withSpan('tables.create-list-records-program'))
}
