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
 *  - deleted rows stay out whatever the request says — the trash is a privilege
 *    of the records route.
 *
 * It delegates to the records list program rather than reading on its own, so
 * a view's page carries the same `pagination` envelope, the same relationship
 * labels (resolved for THIS reader: a visitor gets a label only from a table
 * everyone may read) and the same attachment URLs as the table's own list.
 *
 * The VIEW's grant is checked, not the table's — that is what lets a public
 * view serve a visitor from a private table. Row-level read rules are not
 * applied on this path; a public view on a table that declares them is refused
 * when the config loads.
 */

import { Effect } from 'effect'
import { ForbiddenError } from '@/domain/errors'
import {
  findViewByKey,
  intersectViewFields,
  mergeViewFilter,
  viewSortParam,
} from '@/domain/models/app/tables/views/view-read-service'
import { createListRecordsProgram } from './list-records-program'
import { isViewAccessible, TableNotFoundError } from './table-operations'
import type { RequestedLabel } from './relationship-display-fields'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type {
  QueryFilter,
  TableRepository,
} from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
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
}

interface ViewRecordsConfig {
  readonly tableId: string
  readonly viewId: string
  readonly app: App
  readonly userRole: string
  readonly userGroups?: readonly string[]
  readonly session: Readonly<UserSession>
  readonly query?: ViewRecordsQuery
  /** Request origin, so attachment values carry URLs that round-trip to this server. */
  readonly origin?: string
}

export function getViewRecordsProgram(
  config: ViewRecordsConfig
): Effect.Effect<
  Pick<ListRecordsResponse, 'records' | 'pagination'>,
  TableNotFoundError | ForbiddenError | DatabaseError,
  TableRepository | AuthRepository
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

    if (!isViewAccessible(view, userRole)) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this view')
      )
    }

    const query = config.query ?? {}
    const page = yield* createListRecordsProgram({
      session,
      tableName: table.name,
      app,
      userRole,
      userGroups: config.userGroups,
      labels: query.labels,
      filter: mergeViewFilter(view.filters, query.filter),
      includeDeleted: false,
      sort: query.sort ?? viewSortParam(view.sorts),
      sortByOptionOrder: true,
      fields: intersectViewFields(view.fields, query.fields),
      limit: query.limit,
      offset: query.offset,
      origin: config.origin,
    })

    return { records: page.records.map(withServedAiCompute), pagination: page.pagination }
  }).pipe(Effect.withSpan('tables.get-view-records-program'))
}

type ViewRecord = ListRecordsResponse['records'][number]

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
