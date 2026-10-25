/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import { isGroupReference, stripGroupPrefix } from '@/domain/models/app/auth/groups/group-reference'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  placedTemplatesOf,
  renderedNodesWhere,
} from '@/domain/models/app/pages/component-tree-has-type'
import {
  columnReadableBy,
  routeParamLookupOf,
} from '@/domain/models/app/tables/route-param-lookup-service'
import { admitsRow } from '@/domain/models/app/tables/row-read-admission-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import { recordPassesPredicate, resolveGuardForTable } from './row-level-guard'
import { checkGetReadGate } from './row-level-read-helpers'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App, Table } from '@/domain/models/app'
import type { DeclaredPageMatch } from '@/domain/models/app/pages/page-path-resolvability'
import type { CallerReader } from '@/domain/models/app/tables/caller-record-gate-service'
import type { Context } from 'hono'

/** The page-level single-record binding a record page declares. */
interface SingleRecordBinding {
  readonly table: string
  readonly mode?: string
  readonly param?: string
}

const ROUTE_TABLE_PREFIX = '$param.'

/** The table a binding names: a declared name, or one read from the address. */
function boundTableName(
  binding: SingleRecordBinding,
  match: DeclaredPageMatch
): string | undefined {
  return binding.table.startsWith(ROUTE_TABLE_PREFIX)
    ? match.params[binding.table.slice(ROUTE_TABLE_PREFIX.length)]
    : binding.table
}

/**
 * The live record the address names, looked up as the page reads it — every
 * column, so the row-level read rule can be judged on the same row. ONE read,
 * whatever comes of it: a missing record and a present one cost the same.
 */
async function findLiveRecord(
  c: Context,
  tableName: string,
  lookup: { readonly paramField: string; readonly paramValue: string }
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const { paramField, paramValue } = lookup
  const found = await runOnRequest(
    c,
    Effect.gen(function* () {
      const repo = yield* DataSourceRepository
      return yield* repo.fetchSingleRecord(tableName, paramField, paramValue, undefined, {
        liveOnly: true,
      })
    })
  )
  if (found._tag === 'Success') return found.success
  // A read that fails refuses the stream, exactly as a missing record does —
  // logged, so a reader the rules admit is never refused without a trace.
  logError('[presence] record read failed; refusing the stream', found.failure, { tableName })
  return undefined
}

/** A node's own `mode: 'single'` binding naming a table, if it declares one. */
function singleRecordBindingOf(node: unknown): SingleRecordBinding | undefined {
  const source = (node as { readonly dataSource?: unknown } | null | undefined)?.dataSource
  if (typeof source !== 'object' || source === null) return undefined
  const binding = source as Partial<SingleRecordBinding>
  return binding.mode === 'single' && typeof binding.table === 'string'
    ? (binding as SingleRecordBinding)
    : undefined
}

/**
 * Every single-record binding the page at this address draws: the page's own
 * `dataSource`, and each component's — on the page, in a breakpoint's
 * children, or inside a placed template — which reads its record from the same
 * route parameters.
 */
function singleRecordBindingsOf(
  app: App,
  match: DeclaredPageMatch
): readonly SingleRecordBinding[] {
  const items = (match.page.components ?? []) as readonly unknown[]
  const placed = placedTemplatesOf(items, app.components ?? [])
  const components = renderedNodesWhere(
    items,
    placed,
    (node) => singleRecordBindingOf(node) !== undefined
  )
  return [singleRecordBindingOf(match.page), ...components.map(singleRecordBindingOf)].filter(
    (binding): binding is SingleRecordBinding => binding !== undefined
  )
}

/** The record a presence stream watches: its table and its id. */
export interface WatchedRecord {
  readonly table: string
  readonly recordId: string
}

/**
 * One binding's verdict: `undefined` when the address names no record for it,
 * otherwise whether the caller may read the record, and the record watched.
 */
type BoundRecordVerdict =
  | undefined
  | { readonly admitted: false }
  | { readonly admitted: true; readonly watched: WatchedRecord }

/**
 * Whether the caller may read the record one binding shows at this address.
 *
 * The work done before an answer does not depend on whether the record exists
 * or whether the rule hides it — a missing record and a hidden one cost the
 * same reads in the same order, so the time to the 404 tells nothing:
 *
 *  1. the table's read gate — the caller's guard (resolved from her roles,
 *     groups and assignments, never from the record) and the table's grant;
 *     no record is read, and a refusal stops here for every address alike —
 *     then the rows a list of the table returns her (`readerRowsOf`), which
 *     depend on her grants alone, never on the record the address names;
 *  2. ONE read of the record by the address, every column — none for a
 *     segment no column of that type could hold, which names no record;
 *  3. the row-level read rule judged in memory on that row, when the caller is
 *     held to one, and the row's id among the rows step 1 admits her. No
 *     record → refused; a record the rule or her rows hide → refused.
 */
async function admitsBoundRecord(
  c: Context,
  app: App,
  input: { readonly binding: SingleRecordBinding; readonly match: DeclaredPageMatch }
): Promise<BoundRecordVerdict> {
  const { binding, match } = input
  const tableName = boundTableName(binding, match)
  const table = app.tables?.find((t) => t.name === tableName)
  if (table === undefined) return { admitted: false }
  const param = binding.param ?? table.name
  const paramValue = match.params[param]
  if (paramValue === undefined) return undefined
  const gate = await readGateOf(c, app, table)
  if (gate === 'refused') return { admitted: false }
  const { admission } = await runDomainPromise(c, readerRowsOf(app, table.name, gate.reader))
  const row = await findSegmentRecord(c, app, { table, param, paramValue })
  const recordId = idOf(row)
  if (row === undefined || recordId === undefined) return { admitted: false }
  if (!passesRowReadRule(table, row, gate.guard)) return { admitted: false }
  if (!admitsRow(admission, recordId)) return { admitted: false }
  return { admitted: true, watched: { table: table.name, recordId } }
}

/**
 * The live record a segment names, as the page reads it: by the column named
 * like the parameter, else by id. A value no such column could hold, or a
 * column the caller may not read, names none — refused after the same gate
 * reads, so the answer is the one a missing record gets.
 */
async function findSegmentRecord(
  c: Context,
  app: App,
  segment: { readonly table: Table; readonly param: string; readonly paramValue: string }
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const { table, param, paramValue } = segment
  const readable = columnReadableBy(app, table.name, callerReaderOf(c, app))
  const lookup = routeParamLookupOf(
    table,
    { param, value: paramValue },
    { scopeTables: app.auth?.scopeTables, readable }
  )
  return lookup === undefined
    ? undefined
    : findLiveRecord(c, table.name, { paramField: lookup.field, paramValue: lookup.value })
}

/** The caller as a read decision sees her: her role and groups, or no one when signed out. */
function callerReaderOf(c: Context, app: App): CallerReader | undefined {
  const { session, userRole, userGroups } = getTableContext(c)
  if ((session as typeof session | undefined) === undefined) return undefined
  return {
    userId: session.userId,
    role: userRole,
    groups: userGroups.map((group) => (isGroupReference(group) ? stripGroupPrefix(group) : group)),
    accessRoles: [],
    isUnrestricted: isAdminEquivalent(userRole, app),
  }
}

/** A row's id as the records API names it, or `undefined` for no row. */
function idOf(row: Readonly<Record<string, unknown>> | undefined): string | undefined {
  const id = row?.id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined
}

type RowLevelGuard = Awaited<ReturnType<typeof resolveGuardForTable>>

/**
 * Step 1: the table's read grant for the caller, no record read. The guard it
 * resolves — from her roles, groups and assignments, never from the record —
 * is handed to step 3 rather than resolved again.
 */
async function readGateOf(
  c: Context,
  app: App,
  table: Table
): Promise<'refused' | { readonly guard: RowLevelGuard; readonly reader: LinkReader }> {
  const { session, userRole, userGroups } = getTableContext(c)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  const refusal = checkGetReadGate({ c, app, table, userRole, userGroups, guard })
  const reader = { session, role: userRole, groups: userGroups }
  return refusal === undefined ? { guard, reader } : 'refused'
}

/** Step 3: the row-level read rule, judged in memory on the row step 2 read. */
function passesRowReadRule(
  table: Table,
  row: Readonly<Record<string, unknown>>,
  guard: RowLevelGuard
): boolean {
  if (!table.rowLevelPermissions?.read?.when) return true
  if (!guard || guard.current.isUnrestricted) return true
  // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
  return recordPassesPredicate(
    table.rowLevelPermissions,
    'read',
    readStoredValues(table, row),
    guard.current
  )
}

/**
 * Whether the caller may read the record a page shows at this address.
 *
 * Presence on a record page is the presence of the record at its concrete
 * address (`/orders/42`), so watching it is reading that record. Every
 * `mode: 'single'` binding the page draws — its own `dataSource`, or a
 * component's — resolves the address to its record exactly as the page does:
 * the binding's `param` (or the table name) names the route parameter, matched
 * against the column of that name when the table declares one and the record
 * id otherwise. Each record so named must then pass the records
 * API's rules: the table's read grant, then its row-level read rule — in the
 * order {@link admitsBoundRecord} states, so a record that does not exist and
 * one the rule hides cost the same reads. Either, and a table the app does not
 * declare, refuses the stream.
 *
 * A page that draws no single-record binding, or whose address carries no
 * value for any binding's parameter, shows no one record here: it is admitted
 * watching nothing, and the page rule alone decides.
 */
export async function admitsPresenceRecord(
  c: Context,
  app: App,
  match: DeclaredPageMatch
): Promise<PresenceRecordVerdict> {
  const verdicts = await Promise.all(
    singleRecordBindingsOf(app, match).map((binding) =>
      admitsBoundRecord(c, app, { binding, match })
    )
  )
  const shown = verdicts.filter((verdict) => verdict !== undefined)
  if (shown.some((verdict) => !verdict.admitted)) return { admitted: false }
  return {
    admitted: true,
    watched: shown.flatMap((verdict) => (verdict.admitted ? [verdict.watched] : [])),
  }
}

/**
 * What {@link admitsPresenceRecord} answers: refused, or admitted with every
 * record the page shows at this address — the records whose writes must
 * re-judge the stream (none on a page that shows no one record).
 */
export type PresenceRecordVerdict =
  | { readonly admitted: false }
  | { readonly admitted: true; readonly watched: readonly WatchedRecord[] }
