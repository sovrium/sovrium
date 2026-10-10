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
 * `collection` slug — and each fetches the row whole, because the fetch runs
 * where no session is known. Everything the page then does with that row
 * (prefilling a form, substituting `$record.*`, serialising island props) puts
 * it in the HTML. So the row must answer, per visitor, the same questions the
 * records API asks of the same visitor:
 *
 *  1. **table read** — may this visitor read the table at all?
 *  2. **row-level read** — does `rowLevelPermissions.read.when` admit this row?
 *  3. **field-level read** — which columns may this visitor read?
 *
 * {@link gateRecordForCaller} answers all three: `undefined` when the row is
 * not for this visitor (the caller maps that to its own not-found answer),
 * otherwise the row less the columns the visitor may not read, through the
 * records API's own projection ({@link stripRestrictedColumns}).
 *
 * A `lookup`, `rollup` or `count` column is read from ANOTHER table, so the
 * third gate also leaves out every one of them into a related table or field
 * the visitor may not read, and every formula over one ({@link relatedValuesRefusedTo}) — the records API's answer, and the one a
 * relationship's label already gave — and every lookup through a link to a
 * row the related table's row-level rule hides from her
 * ({@link withRowRuledLookupsHidden}).
 *
 * The row-level predicate is evaluated IN MEMORY against the fetched row
 * rather than appended to the query, because the row is already fetched and a
 * page render has no query builder of its own. {@link callerRecordGateOf}
 * is also what a collection page's `permission-blocked` answer is built from
 * so the two paths cannot disagree about which row
 * a visitor may see.
 */

import {
  callerReaderFromSession,
  callerTableGate,
  type CallerReader,
  type CallerTableGate,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { filterWithFieldLiterals } from '@/domain/models/app/tables/checkbox-literal-service'
import {
  chainedLookupLinksOf,
  lookupKeyColumnsFor,
  lookupLinksOf,
  namesLookup,
  relatedValuesRefusedTo,
  withFormulasOver,
  withoutLookups,
  type LookupLink,
} from '@/domain/models/app/tables/lookup-link-service'
import {
  stripRestrictedColumns,
  type ReadAccessPlan,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import {
  admittedWindow,
  visitorRowRule,
  type VisitorRowRule,
} from '@/domain/models/app/tables/visitor-row-rule-service'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

type RecordRow = Readonly<Record<string, unknown>>

/** "May this visitor see this row?" — `undefined` when there is nothing to ask. */
export type RowLevelReadCheck = (record: RecordRow) => Promise<boolean>

/**
 * The visitor's `user_access` record ids for every scope table the rule reads,
 * in parallel. A failed read degrades to "no assignments": the rule then
 * fails, which is the safe direction.
 */
async function loadAssignmentsForScopes(
  userId: string,
  scopeTables: readonly string[],
  db: DataSourceDb
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (scopeTables.length === 0) return new Map<string, readonly string[]>()
  const entries = await Promise.all(
    scopeTables.map(async (slug): Promise<readonly [string, readonly string[]]> => [
      slug,
      await db.fetchUserAssignments(userId, slug).catch(() => [] as readonly string[]),
    ])
  )
  return new Map(entries)
}

/**
 * The in-memory check of a table's row-level rule for one reader — the
 * domain's {@link visitorRowRule}, her assignments loaded through `db`.
 * `undefined` when there is nothing to check: the table declares no
 * `rowLevelPermissions.read.when`, or the reader is unrestricted (the records
 * API lets an admin-equivalent role read every row, and pages mirror it).
 *
 * A rule naming the signed-in person (`$currentUser.…`) shows an anonymous
 * visitor no row — there is no user to evaluate it against, and failing closed
 * is what the records API's own `'unresolved'` plan does. A rule naming no one
 * (`status = published`) applies to an anonymous reader as to anyone else, as
 * it does on the records API.
 *
 * The reader's assignments are read once per check, however many rows it is
 * then asked about.
 */
function rowCheckOf(
  rule: VisitorRowRule,
  reader: CallerReader | undefined,
  db: DataSourceDb
): RowLevelReadCheck | undefined {
  if (rule.kind === 'all') return undefined
  if (rule.kind === 'none') return () => Promise.resolve(false)
  const assignments =
    reader === undefined || rule.scopeTables.length === 0
      ? Promise.resolve(new Map<string, readonly string[]>())
      : loadAssignmentsForScopes(reader.userId, rule.scopeTables, db)
  return async (record) => rule.admits(record, await assignments)
}

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

/** The key a lookup's relationship column holds on a row, if any. */
const linkKeyOf = (row: RecordRow, link: LookupLink): string | undefined => {
  const value = row[link.relationship]
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') {
    const { id } = value as { readonly id?: unknown }
    return id === undefined || id === null ? undefined : String(id)
  }
  return String(value)
}

/**
 * One link's verdict for a page of rows: the linked keys the visitor may read
 * in the related table, or `undefined` when its row-level rule hides nothing
 * from her. Read once, for every key the rows name.
 */
async function readableLinkedKeys(
  app: App,
  link: LookupLink,
  rows: readonly RecordRow[],
  ctx: { readonly reader: CallerReader | undefined; readonly db: DataSourceDb }
): Promise<ReadonlySet<string> | undefined> {
  const gate = callerTableGate(app, link.relatedTable.name, ctx.reader)
  if (gate.kind === 'refused') return new Set<string>()
  const check = rowCheckOf(gate.rule, ctx.reader, ctx.db)
  if (check === undefined) return undefined
  const keys = [
    ...new Set(rows.flatMap((row) => (link.road === 'column' ? [linkKeyOf(row, link)] : []))),
  ].filter((key): key is string => key !== undefined)
  if (keys.length === 0) return new Set<string>()
  const linked = await ctx.db.fetchRecords(link.relatedTable.name, {
    filter: [{ field: 'id', operator: 'in', value: keys }],
  })
  const verdicts = await Promise.all(linked.map((row) => check(row)))
  return new Set(linked.filter((_, index) => verdicts[index] === true).map((row) => String(row.id)))
}

/** How many tables away a lookup chain is followed before it is left out unjudged. */
const MAX_CHAIN_DEPTH = 8

/** Who reads, through what, and how deep in a lookup chain the judgement is. */
interface LookupJudgement {
  readonly reader: CallerReader | undefined
  readonly db: DataSourceDb
  readonly refused: ReadonlySet<string>
  readonly depth?: number
}

/**
 * One lookup of a lookup's verdict for a page of rows ({@link chainedLookupLinksOf}):
 * the keys of the linked records whose copied field survives the visitor's
 * read of them — read, narrowed to that field, and judged through every link
 * they read in turn, as the records API judges them. `undefined` when the
 * chain cannot be judged by one record (it copies many linked rows, or runs
 * deeper than {@link MAX_CHAIN_DEPTH}): the lookup is then left out whole.
 */
async function clearedChainKeys(
  app: App,
  link: LookupLink,
  rows: readonly RecordRow[],
  ctx: LookupJudgement
): Promise<ReadonlySet<string> | undefined> {
  const depth = ctx.depth ?? 0
  if (link.road !== 'column' || depth >= MAX_CHAIN_DEPTH) return undefined
  const keys = [...new Set(rows.map((row) => linkKeyOf(row, link)))].filter(
    (key): key is string => key !== undefined
  )
  if (keys.length === 0) return new Set<string>()
  const relatedName = link.relatedTable.name
  const kept = new Set([
    'id',
    link.relatedField,
    ...lookupKeyColumnsFor(app, relatedName, [link.relatedField]),
  ])
  const linked = await ctx.db.fetchRecords(relatedName, {
    filter: [{ field: 'id', operator: 'in', value: keys }],
  })
  const judged = await withRowRuledLookupsHidden(
    app,
    relatedName,
    linked.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => kept.has(k)))),
    { ...ctx, refused: new Set<string>(), depth: depth + 1 }
  )
  return new Set(
    judged.filter((row) => Object.hasOwn(row, link.relatedField)).map((row) => String(row['id']))
  )
}

/** Does `link` hide its lookup on `row`, given its verdict for the page? */
function hidesOn(
  row: RecordRow,
  link: LookupLink,
  readable: ReadonlySet<string> | undefined
): boolean {
  if (readable === undefined) return false
  if (link.road !== 'column') return true
  if (!Object.hasOwn(row, link.relationship)) return true
  const key = linkKeyOf(row, link)
  return key !== undefined && !readable.has(key)
}

/**
 * `rows` with every lookup through a link to a row the related table's
 * row-level rule hides from the visitor left out, as the records API leaves it
 * out. A lookup through a key column is judged by its linked row; one that
 * copies many linked rows (many-to-many, or the link a related table holds) is
 * left out whole when a rule governs her there — a page has no recomputation
 * to narrow it with, and leaving it out never shows a hidden value. A lookup
 * of a lookup is judged through every record it reads, the one two tables
 * away included ({@link clearedChainKeys}). Every formula over a lookup left
 * out goes with it. Judged on the RAW rows: the column projection may drop
 * the key it is judged by — and a row that reached here without the key at
 * all cannot be judged, so its lookup is left out.
 */
async function withRowRuledLookupsHidden(
  app: App,
  tableName: string,
  rows: readonly RecordRow[],
  ctx: LookupJudgement
): Promise<readonly RecordRow[]> {
  if (rows.length === 0 || ctx.reader?.isUnrestricted === true) return rows
  const carried = (link: LookupLink) =>
    !ctx.refused.has(link.lookup) &&
    rows.some((row) => namesLookup(app, tableName, new Set(Object.keys(row)), link.lookup))
  const links = lookupLinksOf(app, tableName).filter(
    (link) => link.relatedTable.rowLevelPermissions?.read?.when !== undefined && carried(link)
  )
  const chained = chainedLookupLinksOf(app, tableName).filter(carried)
  if (links.length === 0 && chained.length === 0) return rows
  const verdicts = await Promise.all([
    ...links.map(async (link) => [link, await readableLinkedKeys(app, link, rows, ctx)] as const),
    ...chained.map(
      async (link) =>
        [link, (await clearedChainKeys(app, link, rows, ctx)) ?? new Set<string>()] as const
    ),
  ])
  return rows.map((row) => {
    const hidden = new Set(
      verdicts
        .filter(([link, readable]) => hidesOn(row, link, readable))
        .map(([link]) => link.lookup)
    )
    return withoutLookups([row], withFormulasOver(app, tableName, hidden))[0] ?? row
  })
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
  return {
    kind: 'open',
    rowCheck: rowCheckOf(gate.rule, reader, db),
    project: app.auth
      ? projectOne(projectionOf(app, tableName, reader, { plan: gate.plan, db }))
      : async (record) => record,
  }
}

/**
 * One record, gated for one visitor: `undefined` when the table's read
 * permission refuses the visitor or its row-level rule hides the row, the row
 * less its unreadable columns otherwise. An app with no `auth` block is the
 * full-access model and gets the row back unchanged.
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

/**
 * A hosted form's read of its choices: the form, not the visitor, is granted
 * the table and the two columns a choice is built from (checked once, at
 * load), but the row-level rule is the visitor's, signed in or not.
 */
function formChoicesGate(table: TableLike, reader: CallerReader | undefined): CallerTableGate {
  const rule = visitorRowRule(table, reader)
  return rule.kind === 'none' ? { kind: 'refused' } : { kind: 'open', plan: undefined, rule }
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
 *  2. a row the table's row-level rule hides is not read, nor counted;
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
  // source has no trash. A filter literal is read through its field's type.
  const filter = filterWithFieldLiterals(input.query.filter, table?.fields)
  const query = { ...input.query, filter, liveOnly: input.query.liveOnly ?? table !== undefined }
  if (!app.auth || table === undefined) {
    return readUncheckedRows(tableName, query, { db, withTotal })
  }
  const reader = callerReaderFromSession(session, app)
  const gate =
    input.authority === 'form'
      ? formChoicesGate(table, reader)
      : callerTableGate(app, tableName, reader)
  if (gate.kind === 'refused') return NO_ROWS
  const { plan } = gate
  const check = rowCheckOf(gate.rule, reader, db)
  // A hosted form is granted the columns its choices are built from, by the
  // form; a visitor's read answers to her own gates, lookups included.
  if (input.authority === 'form') {
    const read = await readGatedRows(tableName, query, { db, withTotal, check })
    const rows = read.rows.map((row) =>
      plan === undefined ? row : stripRestrictedColumns(plan, row)
    )
    return { rows, total: read.total }
  }
  // The read is widened by the key of every lookup the binding lists, so the
  // lookup can be judged by its linked record; the answer is narrowed back.
  const read = await readGatedRows(tableName, withLookupKeys(app, tableName, query), {
    db,
    withTotal,
    check,
  })
  const projected = await projectionOf(app, tableName, reader, { plan, db })(read.rows)
  return { rows: projected.map((row) => narrowTo(row, query.fields)), total: read.total }
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

/** Narrow a row to the columns a binding lists; every column when it lists none. */
const narrowTo = (record: RecordRow, fields: readonly string[] | undefined): RecordRow =>
  fields === undefined
    ? record
    : Object.fromEntries(Object.entries(record).filter(([key]) => fields.includes(key)))

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
  return gated === undefined ? undefined : narrowTo(gated, fields)
}
