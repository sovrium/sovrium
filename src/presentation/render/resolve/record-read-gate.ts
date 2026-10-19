/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The records API's three read gates, applied to ONE record a page resolved
 * before any visitor was considered.
 *
 * A page reaches a single record three ways — a component bound with its own
 * `mode: single`, a page-level `dataSource: { mode: single }`, and a
 * `collection` slug — each fetching the row whole, where no session is known.
 * Whatever the page does with it (a prefill, `$record.*`, island props) puts it
 * in the HTML, so the row must answer the records API's questions per visitor:
 * may she read the table (1), does `rowLevelPermissions.read.when` admit the
 * row (2), which columns may she read (3)?
 *
 * {@link gateRecordForCaller} answers all three: `undefined` when the row is
 * not for this visitor, otherwise the row less the columns she may not read,
 * through the records API's own projection ({@link stripRestrictedColumns}),
 * carrying the verdict of its record's controls (`_disabled`), judged whole.
 *
 * A `lookup`, `rollup` or `count` column is read from ANOTHER table, so the
 * third gate also leaves out every one of them into a related table or field
 * the visitor may not read, and every formula over one ({@link relatedValuesRefusedTo}),
 * and every lookup through a link to a row the related table's row-level rule
 * hides from her ({@link withRowRuledLookupsHidden}).
 *
 * The row-level predicate is evaluated IN MEMORY against the fetched row: a page
 * render has no query builder of its own. {@link callerRecordGateOf} is also
 * what a collection page's `permission-blocked` answer is built from, so the
 * two paths cannot disagree about which row a visitor may see.
 */

import {
  callerReaderFromSession,
  callerTableGate,
  type CallerReader,
  type CallerTableGate,
} from '@/domain/models/app/tables/caller-record-gate-service'
import {
  lookupKeyColumnsFor,
  relatedValuesRefusedTo,
  withoutLookups,
} from '@/domain/models/app/tables/lookup-link-service'
import {
  fullAccessReadPlan,
  stripRestrictedColumns,
  type ReadAccessPlan,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { readFilterOf } from '@/domain/models/app/tables/user-list-field-service'
import { admittedWindow, visitorRowRule } from '@/domain/models/app/tables/visitor-row-rule-service'
import { readAdmittedRows, withReaderRowAdmission } from './reader-row-admission'
import { judgedOn, judgedRead, judgedRows, narrowTo } from './record-disabled-controls'
import {
  rowCheckOf,
  withRowRuledLookupsHidden,
  type RowLevelReadCheck,
} from './row-rule-read-check'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

type RecordRow = Readonly<Record<string, unknown>>

/**
 * Rows less their unreadable columns: every lookup, rollup or count into a
 * related table or field the visitor may not read (and every formula over
 * one), every lookup through a link to a row hidden
 * from her ({@link withRowRuledLookupsHidden}), then the columns the table's
 * read plan withholds. An anonymous visitor reads as the `guest` role, as on
 * the records API.
 */
function projectionOf(
  app: App,
  tableName: string,
  reader: CallerReader | undefined,
  ctx: { readonly plan: ReadAccessPlan | undefined; readonly db: DataSourceDb }
): (rows: readonly RecordRow[]) => Promise<readonly RecordRow[]> {
  const refused = relatedValuesRefusedTo(
    app,
    tableName,
    reader === undefined
      ? { role: 'guest', signedOut: true }
      : { role: reader.role, groups: reader.groups, signedOut: false }
  )
  const { plan, db } = ctx
  return async (rows) => {
    const judged = await withRowRuledLookupsHidden(app, tableName, withoutLookups(rows, refused), {
      reader,
      db,
      refused,
    })
    return plan === undefined ? judged : judged.map((row) => stripRestrictedColumns(plan, row))
  }
}

/** A many-row projection asked about one row. */
const projectOne =
  (project: (rows: readonly RecordRow[]) => Promise<readonly RecordRow[]>) =>
  async (record: RecordRow): Promise<RecordRow> =>
    (await project([record]))[0] ?? record

/**
 * The three read gates of ONE table for one visitor, asked before any row of
 * it is read — the domain's {@link callerTableGate} over the reader the
 * page's session names ({@link callerReaderFromSession}), the gate the
 * records API and a hosted form answer too:
 *
 *  - `refused` — the visitor may read no row of the table: its read permission
 *    refuses her (a role her assignment gives counts only on a table with
 *    row-level rules), it is not a declared table, or its row-level rule names
 *    the signed-in person and there is no one signed in;
 *  - `open` — `rowCheck` asks whether a row is for her (`undefined` admits
 *    every row), and `project` hands a row back less the columns she may not
 *    read.
 *
 * An app with no `auth` block is the full-access model: every table is open,
 * with nothing to check and nothing to strip. Every single-record read of a
 * page answers through this — {@link gateRecordForCaller},
 * {@link readRecordForCaller} and a collection page's own 404 / access-denied
 * split — so they cannot disagree about which row a visitor may see.
 */
export type CallerRecordGate =
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'open'
      readonly rowCheck: RowLevelReadCheck | undefined
      readonly project: (record: RecordRow) => Promise<RecordRow>
    }

export function callerRecordGateOf(input: {
  readonly app: App
  readonly tableName: string
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}): CallerRecordGate {
  const { app, tableName, session, db } = input
  const reader = callerReaderFromSession(session, app)
  const gate = callerTableGate(app, tableName, reader)
  if (gate.kind === 'refused') return { kind: 'refused' }
  const open = {
    rowCheck: rowCheckOf(gate.rule, reader, { app, tableName, db }),
    project: app.auth
      ? projectOne(projectionOf(app, tableName, reader, { plan: gate.plan, db }))
      : async (record: RecordRow) => withoutPlanColumns(gate.plan, record),
  }
  const admitted = withReaderRowAdmission({ ...input, reader }, open)
  return { kind: 'open', ...admitted, project: judgedOn(app, tableName, admitted.project) }
}

/**
 * One record, gated for one visitor: `undefined` when the table's read
 * permission refuses the visitor, its row-level rule hides the row or her list
 * does not admit it (`withReaderRowAdmission`), the row as her list shows it
 * otherwise. An app with no `auth` block is the
 * full-access model and gets the row back less its write-only columns.
 */
export async function gateRecordForCaller(input: {
  readonly app: App
  readonly tableName: string
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  readonly record: RecordRow
}): Promise<RecordRow | undefined> {
  const gate = callerRecordGateOf(input)
  if (gate.kind === 'refused') return undefined
  if (gate.rowCheck !== undefined && !(await gate.rowCheck(input.record))) return undefined
  return gate.project(input.record)
}

/** `record` less the plan's restricted columns; unchanged when there is no plan. */
const withoutPlanColumns = (plan: ReadAccessPlan | undefined, record: RecordRow): RecordRow =>
  plan === undefined ? record : stripRestrictedColumns(plan, record)

/**
 * A hosted form's read of its choices: the form, not the visitor, is granted
 * the table and the two columns a choice is built from (checked once, at
 * load), but the row-level rule is the visitor's, signed in or not. The
 * form's grant never reaches a write-only column: its plan withholds those.
 */
function formChoicesGate(
  app: App,
  table: TableLike,
  reader: CallerReader | undefined
): CallerTableGate {
  const rule = visitorRowRule(table, reader)
  return rule.kind === 'none'
    ? { kind: 'refused' }
    : { kind: 'open', plan: fullAccessReadPlan(app, table), rule }
}

/** What a server-side read of many rows asks for. */
export interface CallerRowsQuery {
  readonly fields?: readonly string[]
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
  /** Rows per page; absent reads every matching row. */
  readonly pageSize?: number
  /** 1-based page; `1` when absent. */
  readonly page?: number
  /**
   * Leave out soft-deleted rows. `true` by default on a declared table, as the
   * records API never lists a trashed row; `false` only for a surface that
   * must see the trash on purpose.
   */
  readonly liveOnly?: boolean
}

/** The rows a visitor may read, and how many she may read in all. */
export interface CallerRows {
  readonly rows: readonly RecordRow[]
  /** The admitted rows matching the query, every page included — `0` unless counted. */
  readonly total: number
}

const NO_ROWS: CallerRows = { rows: [], total: 0 }

/**
 * Read the rows the query matches that a row-level check admits. The check
 * reads columns the query need not name (`manager_id`, say), so every column
 * of every matching row is read, judged, then paged and narrowed here — the
 * total is the count of ADMITTED rows, as the records API's is.
 */
async function readCheckedRows(
  tableName: string,
  query: CallerRowsQuery,
  ctx: { readonly db: DataSourceDb; readonly check: RowLevelReadCheck }
): Promise<CallerRows> {
  const matching = await ctx.db.fetchRecords(tableName, {
    ...(query.filter !== undefined ? { filter: query.filter } : {}),
    ...(query.sort !== undefined ? { sort: query.sort } : {}),
    ...(query.liveOnly !== undefined ? { liveOnly: query.liveOnly } : {}),
  })
  const verdicts = await Promise.all(matching.map((row) => ctx.check(row)))
  return admittedWindow(matching, verdicts, query)
}

/** Read the query's page in SQL, and count the matching rows when asked to. */
async function readUncheckedRows(
  tableName: string,
  query: CallerRowsQuery,
  ctx: { readonly db: DataSourceDb; readonly withTotal: boolean }
): Promise<CallerRows> {
  const [rows, total] = await Promise.all([
    ctx.db.fetchRecords(tableName, {
      ...query,
      ...(query.fields !== undefined ? { fields: [...query.fields] } : {}),
      ...(query.pageSize !== undefined ? { page: query.page ?? 1 } : {}),
    }),
    ctx.withTotal
      ? ctx.db.countRecords(tableName, query.filter, { liveOnly: query.liveOnly === true })
      : Promise.resolve(0),
  ])
  return { rows, total }
}

/**
 * Many rows of one table, read for one visitor — THE read every server-drawn
 * list, search, option list and sidebar of a page goes through, so each answers
 * the records API's three read gates exactly as one record does
 * ({@link gateRecordForCaller}):
 *
 *  1. a table the visitor may not read yields no row;
 *  2. a row its row-level rule hides, or its list does not admit, is not read nor counted;
 *  3. every row arrives less the columns the visitor may not read.
 *
 * A trashed row is not read either, as on the records API ({@link CallerRowsQuery.liveOnly}).
 *
 * `withTotal` asks for the count of admitted rows across every page (a pager's
 * total). An app with no `auth` block is the full-access model.
 *
 * `authority: 'form'` is a hosted form's read of its choices: the form, not
 * the visitor, is granted the table and the two columns a choice is built
 * from (checked once, at load), so gates 1 and 3 are the form's — but the
 * row-level rule is the visitor's, signed in or not, exactly as above.
 */
export async function readRowsForCaller(input: {
  readonly app: App
  readonly tableName: string
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  readonly query: CallerRowsQuery
  readonly withTotal?: boolean
  readonly authority?: 'visitor' | 'form'
}): Promise<CallerRows> {
  const { app, tableName, session, db } = input
  const withTotal = input.withTotal === true
  const table = (app.tables ?? []).find((t) => t.name === tableName) as TableLike | undefined
  // A trashed row is drawn on no page (live rows only, unless asked); a system
  // source has no trash. A filter is compiled as `readFilterOf` reads it.
  const filter = readFilterOf(input.query.filter, table?.fields)
  const query = { ...input.query, filter, liveOnly: input.query.liveOnly ?? table !== undefined }
  if (table === undefined) return readUncheckedRows(tableName, query, { db, withTotal })
  if (!app.auth) return readFullAccessRows(app, table, query, { db, withTotal })
  const reader = callerReaderFromSession(session, app)
  const gate =
    input.authority === 'form'
      ? formChoicesGate(app, table, reader)
      : callerTableGate(app, tableName, reader)
  if (gate.kind === 'refused') return NO_ROWS
  const { plan } = gate
  const check = rowCheckOf(gate.rule, reader, { app, tableName, db })
  // A hosted form is granted the columns its choices are built from, by the
  // form; a visitor's read answers to her own gates, lookups included.
  if (input.authority === 'form') {
    const read = await readGatedRows(tableName, query, { db, withTotal, check })
    return { rows: read.rows.map((row) => withoutPlanColumns(plan, row)), total: read.total }
  }
  // The rows her list admits, widened by each listed lookup's key, then narrowed back.
  const ctx = { db, withTotal, check }
  // Also fetched: what its controls are judged on (handed back: the binding's columns, the id).
  const { query: judgedQuery, kept } = judgedRead(app, tableName, query)
  const read = await readAdmittedRows({ app, tableName, session, db, reader }, judgedQuery, {
    read: (admitted) => readGatedRows(tableName, withLookupKeys(app, tableName, admitted), ctx),
    project: judgedRows(app, tableName, projectionOf(app, tableName, reader, { plan, db })),
  })
  return { rows: read.rows.map((row) => narrowTo(row, kept)), total: read.total }
}

/** An app with no `auth`: the full-access model, less the write-only columns no one reads. */
async function readFullAccessRows(
  app: App,
  table: TableLike,
  query: CallerRowsQuery,
  ctx: { readonly db: DataSourceDb; readonly withTotal: boolean }
): Promise<CallerRows> {
  const { query: judged, kept } = judgedRead(app, table.name, query)
  const read = await readUncheckedRows(table.name, judged, ctx)
  const plan = fullAccessReadPlan(app, table)
  const shape = async (rows: readonly RecordRow[]) =>
    rows.map((row) => narrowTo(withoutPlanColumns(plan, row), kept))
  return { rows: await judgedRows(app, table.name, shape)(read.rows), total: read.total }
}

/** The query's page, through the row-level check when one applies. */
const readGatedRows = (
  tableName: string,
  query: CallerRowsQuery,
  ctx: {
    readonly db: DataSourceDb
    readonly withTotal: boolean
    readonly check: RowLevelReadCheck | undefined
  }
): Promise<CallerRows> =>
  ctx.check === undefined
    ? readUncheckedRows(tableName, query, ctx)
    : readCheckedRows(tableName, query, { db: ctx.db, check: ctx.check })

/** `query` with its `fields` widened by the key column of each lookup they list. */
const withLookupKeys = (app: App, tableName: string, query: CallerRowsQuery): CallerRowsQuery => {
  if (query.fields === undefined) return query
  const keys = lookupKeyColumnsFor(app, tableName, query.fields)
  return keys.length === 0 ? query : { ...query, fields: [...query.fields, ...keys] }
}

/**
 * ONE live record of a declared table, read for one visitor and gated
 * ({@link gateRecordForCaller}), then narrowed to `fields` when it lists any:
 *
 *  - `at` — the row whose `field` holds `value` (a route parameter); a trashed
 *    row answers as missing, as on the records API;
 *  - `'first-readable'` — the first row the visitor may read, for a
 *    single-record binding with no route parameter: a row hidden from her is
 *    skipped rather than answered as missing.
 *
 * `undefined` when there is no such row for this visitor. The row is read
 * whole and narrowed only after the gates have read it: a row-level rule reads
 * a column (`manager_id`, say) the binding need not list.
 */
export async function readRecordForCaller(input: {
  readonly app: App
  readonly tableName: string
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  readonly at: { readonly field: string; readonly value: string } | 'first-readable'
  readonly fields?: readonly string[] | undefined
}): Promise<RecordRow | undefined> {
  const { at, db, tableName, fields } = input
  if (at === 'first-readable') {
    const { rows } = await readRowsForCaller({
      ...input,
      query: { pageSize: 1, page: 1, ...(fields !== undefined ? { fields } : {}) },
    })
    return rows[0]
  }
  const record = await db.fetchSingleRecord(tableName, at.field, at.value, undefined, {
    liveOnly: true,
  })
  if (record === undefined) return undefined
  const gated = await gateRecordForCaller({ ...input, record })
  const { kept } = judgedRead(input.app, tableName, { fields }) // keeps the `id` a press names
  return gated === undefined ? undefined : narrowTo(gated, kept)
}
