/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How one table admits a caller's activity, decided ONCE per request — the
 * plan the activity feed (`activity-reader-gate.ts`) judges every entry of
 * that table by, so a feed naming a year of records costs a fixed number of
 * statements per table, never a record read per record.
 *
 * Every function reads the caller from the context `enrichUserRole` filled.
 */

import { Effect } from 'effect'
import { ListActivityGateRecords } from '@/application/use-cases/list-activity-logs'
import { readerRowsOf, type ReaderRows } from '@/application/use-cases/tables/row-read-admission'
import { admitsRow } from '@/domain/models/app/tables/row-read-admission-service'
import { singleRecordAddressRefusal } from '@/domain/models/app/tables/single-record-address'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { rowRuleHolds } from './record-read-gate'
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

type Row = Readonly<Record<string, unknown>>

/**
 * How one table admits the caller's activity, decided ONCE per request — the
 * records read gate (`checkRecordReadGate`) asked of the table rather than of
 * each record:
 *
 * - `refused` — no read grant, an undeclared table, no row the records list
 *   admits, a rule that admits no row, or no single record readable from it;
 * - `all` — the grant and no row-level read rule holding the caller;
 * - `rule` — the rule, projected for the caller, judged by the database;
 * - `in-memory` — the rule judged on each fetched row, exactly as the single
 *   record read judges it: a rule comparing a column with a true/false value.
 *   The row is judged as the records API reads it — a boolean field stored as
 *   `1`/`0` on SQLite read as `true`/`false` (`readStoredValues`) — so the
 *   rule admits the same rows on both engines.
 */
export type TablePlan =
  | { readonly kind: 'refused' }
  | { readonly kind: 'all' }
  | { readonly kind: 'rule'; readonly rule: QueryFilterNode }
  | { readonly kind: 'in-memory'; readonly admits: (row: Row) => boolean }

export const REFUSED: TablePlan = { kind: 'refused' }
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

/** `plan` narrowed to the rows a grant alone opens to the caller, when only those admit her. */
function narrowToRows(plan: TablePlan, admission: ReaderRows['admission']): TablePlan {
  if (admission.kind !== 'granted-rows' || plan.kind === 'refused') return plan
  const idIn: QueryFilterNode = { field: 'id', operator: 'in', value: admission.ids }
  if (plan.kind === 'all') return { kind: 'rule', rule: idIn }
  if (plan.kind === 'rule') return { kind: 'rule', rule: { and: [plan.rule, idIn] } }
  return {
    kind: 'in-memory',
    admits: (row) => admitsRow(admission, String(row.id)) && plan.admits(row),
  }
}

/** One table's plan ({@link TablePlan}): read gate, rows the list admits, then the rule. */
async function planTable(c: Context, app: App, table: Table): Promise<TablePlan> {
  const { session, userRole, userGroups } = getTableContext(c)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  if (checkGetReadGate({ c, app, table, userRole, userGroups, guard })) return REFUSED
  const reader = { session, role: userRole, groups: userGroups }
  const rows = await runRequestEffect(c, provideDomain(c, readerRowsOf(app, table.name, reader)))
  if (rows.admission.kind === 'no-row') return REFUSED
  return narrowToRows(
    rowRuleHolds(guard, table) ? planRule(app, table, guard) : ALL,
    rows.admission
  )
}

/**
 * The plan of every table named, keyed by name — one table after another, so
 * the guard lookups never fan out over the shared connection pool (the QUERY
 * BUDGET note in `tables-overview-repository-live.ts`). A name the app does
 * not declare is refused.
 */
export const planTables = (
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
export async function admissionOf(
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
 * The record ids of `tableName` among `recordIds` the caller may read under
 * its plan — one statement for the table, however many records it names.
 */
export async function readableRecordIds(
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
