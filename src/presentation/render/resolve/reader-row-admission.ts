/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows a server-drawn list may draw: exactly those the records list admits
 * its reader, as the list's own program reads them (`ReadReaderRows`, folded
 * onto the page's `db` by the route). The list decides; a page only applies:
 *
 *  - no row admitted — the table answers as one that does not exist, so the
 *    page draws no row and counts none;
 *  - the rows a grant admits — the read is narrowed to them, in SQL, so its
 *    pager counts them alone;
 *  - each granted row shows every field the reader may read under her own role
 *    or under a role a grant gives her on that row (`callersOfRow`), and a
 *    list's template may name a field a grant shows her on every such row.
 */

import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  callerReaderFromSession,
  type CallerReader,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { filterFieldsReadableByAny } from '@/domain/models/app/tables/field-read-filter-service'
import {
  admitsRow,
  callersOfRow,
  fieldReadOnEveryAdmittedRow,
  signedOutRowAdmission,
  type RowGrants,
  type RowReadAdmission,
} from '@/domain/models/app/tables/row-read-admission-service'
import type { DataSourceDb, QueryLookupMasks } from './data-source-contracts'
import type { RowLevelReadCheck } from './row-rule-read-check'
import type { ReadReaderRows } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { ReadAccessPlan } from '@/domain/models/app/tables/read-access-plan-service'

type RecordRow = Readonly<Record<string, unknown>>

/**
 * `filter` narrowed to the rows `admission` admits: unchanged for every row,
 * `id IN` the granted rows otherwise. A caller has
 * already answered a `no-row` admission with no row.
 */
const filterToAdmittedRows = (
  filter: readonly DataFilter[],
  admission: RowReadAdmission
): readonly DataFilter[] =>
  admission.kind === 'granted-rows'
    ? [...filter, { field: 'id', operator: 'in', value: [...admission.ids] }]
    : filter

/**
 * Each projected row with the fields a grant on it shows its reader, read off
 * the stored row (`raw`, the same index) under every role the grant gives her.
 */
const withGrantedFields = (
  read: {
    readonly app: App
    readonly tableName: string
    readonly reader: CallerReader | undefined
    readonly grants: RowGrants | undefined
  },
  raw: readonly RecordRow[],
  projected: readonly RecordRow[]
): readonly RecordRow[] => {
  const { app, tableName, reader, grants } = read
  if (reader === undefined || grants === undefined || grants.size === 0) return projected
  const caller = { role: reader.role, groups: reader.groups }
  return projected.map((row, index) => {
    const stored = raw[index] ?? row
    const granted = callersOfRow(caller, grants, stored['id']).slice(1)
    if (granted.length === 0) return row
    const shown = filterFieldsReadableByAny({ app, tableName, callers: granted, record: stored })
    return { ...row, ...shown }
  })
}

/**
 * The rows a table admits a render that brings no reader of its own (a feed,
 * the operator console's mounted surfaces): a visitor who is not signed in
 * reads the rows the records list admits her (`signedOutRowAdmission`). One
 * holding a session it cannot judge reads none — it fails closed.
 */
export const signedOutReaderRows: ReadReaderRows = async (app, tableName, session) => ({
  admission:
    session === undefined || isGuestSession(session.userId)
      ? signedOutRowAdmission(app, tableName)
      : { kind: 'no-row' },
  grants: new Map(),
})

/**
 * Whether a read names a field a lookup or count mask could steer it on: a
 * filter or a sort. A read naming neither reads every admitted row in its
 * stored order, so its masks are never computed.
 */
export const namesSteeringFields = (query: {
  readonly filter: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}): boolean => query.filter.length > 0 || (query.sort?.length ?? 0) > 0

/** Rows read, and how many match across every page. */
interface RowsRead {
  readonly rows: readonly RecordRow[]
  readonly total: number
}

/** What a server-drawn read asks: its filter, its sort, and the masks it steers by. */
interface AdmittedQuery {
  readonly filter: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
  readonly lookupMasks?: QueryLookupMasks
}

/**
 * The rows of a server-drawn read its list admits its reader: none when it
 * admits none, else the read narrowed to the admitted rows (`via.read`, which
 * counts them alone) — steering on each lookup and count it names as her
 * records list does (`db.readQueryMasks`) — projected for her (`via.project`)
 * and given the fields each row's grants show her.
 */
export async function readAdmittedRows<Q extends AdmittedQuery>(
  input: {
    readonly app: App
    readonly tableName: string
    readonly session: SessionInfo | undefined
    readonly db: DataSourceDb
    readonly reader: CallerReader | undefined
  },
  query: Q,
  via: {
    readonly read: (query: Q) => Promise<RowsRead>
    readonly project: (rows: readonly RecordRow[]) => Promise<readonly RecordRow[]>
  }
): Promise<RowsRead> {
  const { app, tableName, session, db, reader } = input
  const { admission, grants } = await db.readReaderRows(app, tableName, session)
  if (admission.kind === 'no-row') return { rows: [], total: 0 }
  const named = { filter: query.filter, ...(query.sort === undefined ? {} : { sort: query.sort }) }
  // A read naming no field steers on nothing: no mask to compute.
  const masks = namesSteeringFields(named)
    ? ((await db.readQueryMasks?.(app, tableName, session, named)) ?? [])
    : []
  const read = await via.read({
    ...query,
    filter: filterToAdmittedRows(query.filter, admission),
    ...(masks.length > 0 && { lookupMasks: masks }),
  })
  const projected = await via.project(read.rows)
  const rows = withGrantedFields({ app, tableName, reader, grants }, read.rows, projected)
  return { rows, total: read.total }
}

/** How one record is judged and shaped for its reader. */
interface RecordReadGate {
  readonly rowCheck: RowLevelReadCheck | undefined
  readonly project: (record: RecordRow) => Promise<RecordRow>
}

/**
 * A single-record gate that also answers what the records list admits its
 * reader: a row the list does not admit fails `rowCheck` — so a page answers
 * it exactly as a missing row — and an admitted row is projected with the
 * fields each grant on it shows her, as the list shows them. Unchanged in an
 * app without auth, where every reader reads every row.
 */
export const withReaderRowAdmission = (
  input: {
    readonly app: App
    readonly tableName: string
    readonly session: SessionInfo | undefined
    readonly db: DataSourceDb
    readonly reader: CallerReader | undefined
  },
  gate: RecordReadGate
): RecordReadGate => {
  const { app, tableName, session, db, reader } = input
  if (!app.auth) return gate
  const rowsOf = () => db.readReaderRows(app, tableName, session)
  return {
    rowCheck: async (record) =>
      admitsRow((await rowsOf()).admission, String(record['id'])) &&
      (gate.rowCheck === undefined || (await gate.rowCheck(record))),
    project: async (record) => {
      const projected = await gate.project(record)
      const { grants } = await rowsOf()
      const read = { app, tableName, reader, grants }
      return withGrantedFields(read, [record], [projected])[0] ?? projected
    },
  }
}

/**
 * The columns a binding's template may not name for its reader: those her read
 * plan restricts, less those a grant shows her on EVERY row her list admits
 * (`fieldReadOnEveryAdmittedRow`) when she reads only the rows a grant admits.
 */
export const restrictedColumnsForReader = async (ctx: {
  readonly app: App
  readonly tableName: string
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  readonly plan: ReadAccessPlan | undefined
}): Promise<ReadonlySet<string>> => {
  const restricted = ctx.plan?.restrictedColumns ?? new Set<string>()
  const reader = callerReaderFromSession(ctx.session, ctx.app)
  if (restricted.size === 0 || reader === undefined) return restricted
  const rows = await ctx.db.readReaderRows(ctx.app, ctx.tableName, ctx.session)
  if (rows.admission.kind !== 'granted-rows') return restricted
  const related = { role: reader.role, groups: reader.groups, signedOut: false }
  const read = { app: ctx.app, tableName: ctx.tableName, reader: related }
  return new Set([...restricted].filter((field) => !fieldReadOnEveryAdmittedRow(read, rows, field)))
}
