/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/tables/:table/views/:view/records` — the rows of one declared view.
 *
 * A view is a saved projection, and this program is the paged records read
 * with the projection applied on the server, never after it:
 *  - the view's `filters` come first and the caller's filter is AND-merged
 *    behind them, so a caller narrows a view and never un-applies it;
 *  - the caller's `?fields=` is intersected with the view's `fields`, and the
 *    reader's own field grants still narrow inside that (the list program
 *    strips what the role may not read);
 *  - the caller's sort wins over the view's, which is the default order;
 *  - the view's `groupBy` is applied whatever the caller asks: the response
 *    carries the whole-view count (and the asked totals) of every group at
 *    every level, as the records list does for `?groupBy=`;
 *  - deleted rows stay out whatever the request says — the trash is a privilege
 *    of the records route.
 *
 * It delegates to the records list program rather than reading on its own, so
 * a view's page carries the same `pagination` envelope, the same relationship
 * labels (resolved for THIS reader: a visitor gets a label only from a table
 * everyone may read) and the same attachment URLs as the table's own list.
 *
 * A view that declares a grant is checked on it, not on the table's read —
 * that is what lets a public view serve a visitor from a private table. A view
 * that declares none inherits its table's read, the records route's own gate.
 * The route folds the table's row-level read rule into the query; a public
 * view on a table that declares one is refused when the config loads.
 */

import { Effect } from 'effect'
import { ForbiddenError } from '@/domain/errors'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  findViewByKey,
  mergeViewFilter,
  viewGroupByParam,
  viewFiltersForReader,
  viewReadFields,
  viewReader,
  viewSortParam,
} from '@/domain/models/app/tables/views/view-read-service'
import { createAggregateRecordsProgram, type AggregateRatio } from './aggregate-records-program'
import { createListRecordsProgram } from './list-records-program'
import { TableNotFoundError, viewReadAdmits, type TableCaller } from './table-operations'
import type { AggregateConfig } from './aggregation-helpers'
import type { RequestedLabel } from './relationship-display-fields'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AiComputeStatusRepository } from '@/application/ports/repositories/ai/ai-compute-status-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  QueryFilter,
  TableRepository,
} from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError, ValidationError } from '@/domain/errors'
import type { ListRecordsResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

/** What the caller asked of the view, already parsed and checked by the route. */
export interface ViewRecordsQuery {
  readonly filter?: QueryFilter
  readonly sort?: string
  readonly fields?: string
  readonly limit?: number
  readonly offset?: number
  readonly labels?: readonly RequestedLabel[]
  /**
   * `?aggregate=` — the whole-view totals a grid's summary row asks for,
   * computed over the rows the view returns (its filters included).
   */
  readonly aggregate?: AggregateConfig
  /**
   * `?numerator=` and `?denominator=` — a ratio's two sides, each counted over
   * every row the view returns (its filters, the caller's and the row rule).
   */
  readonly ratio?: { readonly numerator?: QueryFilter; readonly denominator?: QueryFilter }
}

interface ViewRecordsConfig {
  readonly tableId: string
  readonly viewId: string
  readonly app: App
  readonly userRole: string
  readonly userGroups?: readonly string[]
  /**
   * The `user_access` roles the caller holds, which the records route adds on
   * a table with row-level rules — so a view inheriting that table's read
   * admits exactly whom its records admit.
   */
  readonly accessRoles?: readonly string[]
  readonly session: Readonly<UserSession>
  readonly query?: ViewRecordsQuery
  /** Request origin, so attachment values carry URLs that round-trip to this server. */
  readonly origin?: string
}

/** The caller the view's grant — or, without one, its table's read — is asked about. */
const callerOf = (config: ViewRecordsConfig): TableCaller => ({
  role: config.userRole,
  groups: config.userGroups ?? [],
  accessRoles: config.accessRoles ?? [],
  anonymous: isGuestSession(config.session.userId),
})

/** The reader the view's filters name: none for a visitor with no account. */
const readerOf = (config: ViewRecordsConfig) =>
  viewReader(config.session.userId, config.userRole, isGuestSession(config.session.userId))

/** Both conditions of a filter, ANDed: the read's own and one ratio side's. */
const andFilters = (
  left: QueryFilter | undefined,
  right: QueryFilter | undefined
): QueryFilter => ({ and: [...(left?.and ?? []), ...(right?.and ?? [])] })

/**
 * A ratio's two counts over every row the view returns, read by the aggregate
 * read's own counting (reader rows and related-text rules included); nothing
 * when no ratio was asked.
 */
const readViewRatio = (
  config: ViewRecordsConfig,
  input: { readonly tableName: string; readonly filter: QueryFilter | undefined }
): Effect.Effect<
  { readonly ratio?: AggregateRatio },
  DatabaseError | ValidationError | TableNotFoundError,
  TableRepository | AuthRepository | DataSourceRepository
> => {
  const sides = config.query?.ratio
  if (sides === undefined) return Effect.succeed({})
  return createAggregateRecordsProgram({
    session: config.session,
    tableName: input.tableName,
    app: config.app,
    userRole: config.userRole,
    userGroups: config.userGroups,
    filter: input.filter,
    includeDeleted: false,
    ratio: {
      numerator: andFilters(input.filter, sides.numerator),
      denominator: andFilters(input.filter, sides.denominator),
    },
  }).pipe(
    Effect.map(({ ratio }) => (ratio === undefined ? {} : { ratio })),
    // A reader who may read no row of the table is answered as if it did not exist.
    Effect.catchTag('NotFoundError', () => Effect.fail(new TableNotFoundError('Table not found'))),
    Effect.withSpan('tables.read-view-ratio')
  )
}

export function getViewRecordsProgram(config: ViewRecordsConfig): Effect.Effect<
  Pick<ListRecordsResponse, 'records' | 'pagination' | 'aggregations' | 'groups'> & {
    readonly ratio?: AggregateRatio
  },
  TableNotFoundError | ForbiddenError | DatabaseError | ValidationError,
  TableRepository | AuthRepository | DataSourceRepository | AiComputeStatusRepository
> {
  return Effect.gen(function* () {
    const { tableId, viewId, app, userRole, session } = config
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)
    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    const view = findViewByKey(table.views, viewId)
    if (!view) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

    if (!viewReadAdmits(app, table, view, callerOf(config))) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this view')
      )
    }

    const query = config.query ?? {}
    const groupBy = viewGroupByParam(view.groupBy)
    // A condition naming the reader (`owner equals $currentUser.id`) reads as theirs.
    const readerFilters = viewFiltersForReader(view.filters, readerOf(config), table.fields)
    const filter = mergeViewFilter(readerFilters, query.filter)
    const page = yield* createListRecordsProgram({
      session,
      tableName: table.name,
      app,
      userRole,
      userGroups: config.userGroups,
      labels: query.labels,
      filter,
      includeDeleted: false,
      sort: query.sort ?? viewSortParam(view.sorts),
      sortByOptionOrder: true,
      fields: viewReadFields(view, query.fields),
      limit: query.limit,
      offset: query.offset,
      ...(query.aggregate !== undefined && { aggregate: query.aggregate }),
      ...(groupBy !== undefined && { groupBy }),
      origin: config.origin,
    }).pipe(
      // A reader who may read no row of the table is answered as if it did not exist.
      Effect.catchTag('NotFoundError', () => Effect.fail(new TableNotFoundError('Table not found')))
    )

    const ratio = yield* readViewRatio(config, { tableName: table.name, filter })
    return { ...servedPage(page), ...ratio }
  }).pipe(Effect.withSpan('tables.get-view-records-program'))
}

type ViewRecord = ListRecordsResponse['records'][number]

/** The list program's page as this route answers it. */
const servedPage = (
  page: ListRecordsResponse
): Pick<ListRecordsResponse, 'records' | 'pagination' | 'aggregations' | 'groups'> => ({
  records: page.records.map(withServedAiCompute),
  pagination: page.pagination,
  ...(page.aggregations !== undefined && { aggregations: page.aggregations }),
  ...(page.groups !== undefined && { groups: page.groups }),
})

/**
 * A record's `_aiCompute` block narrowed to the columns the record carries.
 *
 * The list program attaches one status entry per AI-compute field of the
 * TABLE, whatever the read selected — so through a view it would name a
 * column the view withholds, with its provider error text, to a reader the
 * view exists to keep from it. What survives is exactly what `fields` holds,
 * which is already the view's whitelist narrowed by the reader's grants.
 */
const withServedAiCompute = (record: ViewRecord): ViewRecord => {
  const { _aiCompute: aiCompute, ...rest } = record
  if (aiCompute === undefined) return record
  const served = Object.entries(aiCompute).filter(([field]) => field in record.fields)
  return served.length === 0 ? rest : { ...rest, _aiCompute: Object.fromEntries(served) }
}
