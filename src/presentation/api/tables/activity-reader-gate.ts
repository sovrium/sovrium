/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ListActivityGateRecords } from '@/application/use-cases/list-activity-logs'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { filterReadableChanges } from '@/domain/models/app/tables/field-read-filter-service'
import { singleRecordAddressRefusal } from '@/domain/models/app/tables/single-record-address'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { checkRecordReadGate } from './record-read-gate'
import {
  projectReadPredicateClause,
  recordPassesPredicate,
  resolveGuardForTable,
  type RowLevelGuardContext,
} from './row-level-guard'
import { checkGetReadGate } from './row-level-read-helpers'
import type {
  ActivityTableAdmission,
  LiveRecordsQuery,
} from '@/application/ports/repositories/analytics/activity-log-repository'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The activity feed shows a reader only what the records API would show her.
 *
 * An entry IS a record's values at a moment, so it is gated exactly as a read
 * of that record (`checkRecordReadGate`): the table's read grant, then its
 * row-level read rule judged on the record as it stands. A table the app no
 * longer declares admits nobody but an admin. Its `changes` keep only the
 * fields the reader may read, and another actor is named by id and name —
 * her email stays on admin surfaces. A reader's OWN email stays on her own
 * entries.
 *
 * The agent `entries` follow one audience rule. An admin reads them all. A
 * non-admin reads an approval decision she made herself, or one made on a run
 * she started — both judged by her account id, never her role or email. She
 * reads an agent action as she would read its target record: the records read
 * gate of its table and row, or of its table alone when the action kept no
 * row id; an action touching no table only when she started its run.
 *
 * COST. A feed names every record of the last year, so the list never judges
 * record by record: each table's gate is resolved ONCE per request (grant and
 * the caller's projected row rule), and the rule is judged by the database in
 * the statement that pages and counts the entries — a fixed number of
 * statements per table, whatever the number of records.
 *
 * Every function reads the caller from the context `enrichUserRole` filled.
 */

/** The part of an activity entry the gate judges. */
interface GatedEntry {
  readonly tableName: string
  readonly recordId: string
}

/** The actor shape an entry names, before projection. */
interface EntryActor {
  readonly id: string
  readonly name: string
  readonly email: string
}

/** The actor as a non-admin reads another user: no email. */
interface PublicActor {
  readonly id: string
  readonly name: string
}

/**
 * `true` when the caller is admin-equivalent — the built-in `admin` or the
 * app's top role, the one predicate every admin door asks — for whom the feed
 * is whole.
 */
export function readerIsAdmin(c: Context, app: App): boolean {
  return isAdminEquivalent(getTableContext(c).userRole, app)
}

/**
 * Whether the caller may read the record an entry was written on.
 */
export async function admitsActivityEntry(
  c: Context,
  app: App,
  entry: GatedEntry
): Promise<boolean> {
  if (readerIsAdmin(c, app)) return true
  const table = app.tables?.find((t) => t.name === entry.tableName)
  if (!table) return false
  return (await checkRecordReadGate(c, app, table, entry.recordId)) === undefined
}

type Row = Readonly<Record<string, unknown>>

/**
 * How one table admits the caller's activity, decided ONCE per request — the
 * records read gate (`checkRecordReadGate`) asked of the table rather than of
 * each record:
 *
 * - `refused` — no read grant, a table the app does not declare, a rule that
 *   admits no row, or a table no single record can be read from;
 * - `all` — the grant and no row-level read rule holding the caller;
 * - `rule` — the rule, projected for the caller, judged by the database;
 * - `in-memory` — the rule judged on each fetched row, exactly as the single
 *   record read judges it: a rule comparing a column with a true/false value.
 *   The row is judged as the records API reads it — a boolean field stored as
 *   `1`/`0` on SQLite read as `true`/`false` (`readStoredValues`) — so the
 *   rule admits the same rows on both engines.
 */
type TablePlan =
  | { readonly kind: 'refused' }
  | { readonly kind: 'all' }
  | { readonly kind: 'rule'; readonly rule: QueryFilterNode }
  | { readonly kind: 'in-memory'; readonly admits: (row: Row) => boolean }

const REFUSED: TablePlan = { kind: 'refused' }
const ALL: TablePlan = { kind: 'all' }

/** Whether a projected rule compares anything with a boolean. */
const comparesBoolean = (node: QueryFilterNode): boolean => {
  if ('and' in node) return node.and.some(comparesBoolean)
  if ('or' in node) return node.or.some(comparesBoolean)
  const values: readonly unknown[] = Array.isArray(node.value) ? node.value : [node.value]
  return values.some((value) => typeof value === 'boolean')
}

/** The plan of a table whose row-level read rule holds the caller. */
function planRule(app: App, table: Table, guard: RowLevelGuardContext): TablePlan {
  const rlp = table.rowLevelPermissions
  if (singleRecordAddressRefusal(app, table.name) !== undefined) return REFUSED
  const clause = projectReadPredicateClause(rlp, guard.current)
  if (clause === 'bypass' || clause === 'no-rlp') return ALL
  if (clause === 'empty' || clause === undefined) return REFUSED
  if (!comparesBoolean(clause)) return { kind: 'rule', rule: clause }
  return {
    kind: 'in-memory',
    admits: (row) =>
      recordPassesPredicate(rlp, 'read', readStoredValues(table, row), guard.current),
  }
}

/** The plan for one table (see {@link TablePlan}). */
async function planTable(c: Context, app: App, table: Table): Promise<TablePlan> {
  const { session, userRole, userGroups } = getTableContext(c)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  if (checkGetReadGate({ c, app, table, userRole, userGroups, guard })) return REFUSED
  if (!guard || !table.rowLevelPermissions?.read?.when || guard.current.isUnrestricted) return ALL
  return planRule(app, table, guard)
}

/**
 * The plan of every table named, keyed by name — one table after another, so
 * the guard lookups never fan out over the shared connection pool (the QUERY
 * BUDGET note in `tables-overview-repository-live.ts`). A name the app does
 * not declare is refused.
 */
const planTables = (
  c: Context,
  app: App,
  tableNames: readonly string[]
): Promise<ReadonlyMap<string, TablePlan>> =>
  [...new Set(tableNames)].reduce<Promise<ReadonlyMap<string, TablePlan>>>(async (done, name) => {
    const planned = await done
    const table = app.tables?.find((t) => t.name === name)
    const plan = table === undefined ? REFUSED : await planTable(c, app, table)
    return new Map([...planned, [name, plan]])
  }, Promise.resolve(new Map()))

/**
 * The live rows a gate judges, in one statement; none when the read fails —
 * the gate then admits nothing from them, as a failed record read refuses.
 */
async function gateRecords(c: Context, query: LiveRecordsQuery): Promise<readonly Row[]> {
  const result = await runRequestEffect(
    c,
    provideDomain(c, ListActivityGateRecords(query)).pipe(Effect.result)
  )
  if (result._tag === 'Success') return result.success
  logError('[activity] gate records read failed', result.failure)
  return []
}

/** The ids of `rows`, as text — the form the activity log keeps them in. */
const idsOf = (rows: readonly Row[]): readonly string[] => rows.map((row) => String(row.id))

/** One table's admission to the activity list, from its plan. */
async function admissionOf(
  c: Context,
  tableName: string,
  plan: TablePlan
): Promise<readonly ActivityTableAdmission[]> {
  if (plan.kind === 'refused') return []
  if (plan.kind === 'all') return [{ tableName, rows: 'all' }]
  if (plan.kind === 'rule') return [{ tableName, rows: 'rule', rule: plan.rule }]
  const rows = await gateRecords(c, { tableName, recordIds: 'logged' })
  return [{ tableName, rows: 'listed', recordIds: idsOf(rows.filter(plan.admits)) }]
}

/**
 * What of the activity list the caller reads: `everything` for an admin, else
 * the tables (and, under a row-level read rule, the rows) the records API lets
 * her read — each table's gate resolved once, the rows judged by the database
 * in the statement that pages them, so the page and its total count admitted
 * entries only. `tableName` narrows the tables planned to the one filtered on.
 */
export async function activityAdmission(
  c: Context,
  app: App,
  tableName: string | undefined
): Promise<'everything' | readonly ActivityTableAdmission[]> {
  if (readerIsAdmin(c, app)) return 'everything'
  const names = (app.tables ?? [])
    .map((table) => table.name)
    .filter((name) => tableName === undefined || name === tableName)
  const plans = await planTables(c, app, names)
  return [...plans].reduce<Promise<readonly ActivityTableAdmission[]>>(
    async (done, [name, plan]) => [...(await done), ...(await admissionOf(c, name, plan))],
    Promise.resolve([])
  )
}

/**
 * Name the actor as this caller may see her: whole for an admin or for the
 * caller's own entries, id and name otherwise.
 */
export function projectActivityActor<A extends EntryActor>(
  c: Context,
  app: App,
  actor: A | null
): A | PublicActor | null {
  if (actor === null) return null
  if (readerIsAdmin(c, app) || actor.id === getTableContext(c).session.userId) return actor
  return { id: actor.id, name: actor.name }
}

/**
 * An activity `entries` item as this caller may see it: another user's email
 * is dropped for a non-admin, her id (and name, when the entry carries one)
 * kept. An admin, and the caller on her own entries, read it whole. An actor
 * carrying no email — an agent — passes unchanged.
 */
export function projectEntryActor<E extends { readonly actor: object }>(
  c: Context,
  app: App,
  entry: E
): E | (Omit<E, 'actor'> & { readonly actor: Partial<E['actor']> }) {
  const { actor } = entry
  if (readerIsAdmin(c, app) || !('email' in actor)) return entry
  if ('id' in actor && actor.id === getTableContext(c).session.userId) return entry
  const { email: _email, ...withoutEmail } = actor
  return { ...entry, actor: withoutEmail }
}

/** An entry's change set, holding only the fields the caller may read. */
export function projectActivityChanges(
  c: Context,
  app: App,
  tableName: string,
  changes: unknown
): unknown {
  const { userRole, userGroups } = getTableContext(c)
  return filterReadableChanges({
    app,
    tableName,
    caller: { role: userRole, groups: userGroups },
    changes,
  })
}

/**
 * An agent `entries` item, as far as the audience rule reads it — a decision
 * (it names its `approvalId`) or an agent action. Structural, so this gate
 * needs nothing of the agents surface that stores them.
 */
type AudienceEntry =
  | {
      readonly approvalId: string
      readonly actor: { readonly id: string }
      readonly runStartedById: string | undefined
    }
  | {
      readonly targetTable: string | undefined
      readonly recordId: string | undefined
      readonly runStartedById: string | undefined
    }

/** The table and row an agent action is judged on, as one memo key. */
const actionKey = (table: string, recordId: string | undefined): string =>
  `${table}\u0000${recordId ?? ''}`

/**
 * The record ids of `tableName` among `recordIds` the caller may read under
 * its plan — one statement for the table, however many records it names.
 */
async function readableRecordIds(
  c: Context,
  tableName: string,
  plan: TablePlan,
  recordIds: readonly string[]
): Promise<ReadonlySet<string>> {
  if (plan.kind === 'refused' || recordIds.length === 0) return new Set()
  if (plan.kind === 'all') return new Set(recordIds)
  if (plan.kind === 'rule') {
    return new Set(idsOf(await gateRecords(c, { tableName, recordIds, rule: plan.rule })))
  }
  return new Set(idsOf((await gateRecords(c, { tableName, recordIds })).filter(plan.admits)))
}

/**
 * Whether the caller may read each agent action, keyed by {@link actionKey}:
 * the records read gate of its table and row — or, for an action that kept no
 * row id, of its table alone, which a row-level read rule holding the caller
 * refuses since no record exists to judge it on. Each table is planned once
 * and its rows judged in one statement.
 */
async function agentActionVerdicts(
  c: Context,
  app: App,
  targets: readonly { readonly table: string; readonly recordId: string | undefined }[]
): Promise<ReadonlyMap<string, boolean>> {
  const plans = await planTables(
    c,
    app,
    targets.map((target) => target.table)
  )
  const readable = await [...plans].reduce<Promise<ReadonlyMap<string, ReadonlySet<string>>>>(
    async (done, [table, plan]) => {
      const ids = targets.flatMap((target) =>
        target.table === table && target.recordId !== undefined ? [target.recordId] : []
      )
      return new Map([...(await done), [table, await readableRecordIds(c, table, plan, ids)]])
    },
    Promise.resolve(new Map())
  )
  return new Map(
    targets.map((target) => {
      const plan = plans.get(target.table) ?? REFUSED
      const admitted =
        target.recordId === undefined
          ? plan.kind === 'all'
          : readable.get(target.table)?.has(target.recordId) === true
      return [actionKey(target.table, target.recordId), admitted] as const
    })
  )
}

/**
 * Keep the agent `entries` this caller may read, in order (the audience rule
 * above). Each table is judged once, however many actions touched it.
 */
export async function filterAudienceEntries<E extends AudienceEntry>(
  c: Context,
  app: App,
  entries: readonly E[]
): Promise<readonly E[]> {
  if (readerIsAdmin(c, app)) return entries
  const callerId = getTableContext(c).session.userId
  const targets = entries.flatMap((entry) =>
    'approvalId' in entry || entry.targetTable === undefined
      ? []
      : [{ table: entry.targetTable, recordId: entry.recordId }]
  )
  const verdicts = await agentActionVerdicts(c, app, targets)
  return entries.filter((entry) => {
    if ('approvalId' in entry) {
      return entry.actor.id === callerId || entry.runStartedById === callerId
    }
    if (entry.targetTable === undefined) return entry.runStartedById === callerId
    return verdicts.get(actionKey(entry.targetTable, entry.recordId)) === true
  })
}

/** An `entries` item as it goes on the wire: who started its run stays here. */
export function toWireEntry<E extends AudienceEntry>(entry: E): Omit<E, 'runStartedById'> {
  const { runStartedById: _startedBy, ...wire } = entry
  return wire
}
