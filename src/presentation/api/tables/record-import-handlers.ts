/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/tables/:tableId/records/import` — the grid's CSV import, one
 * chunk of rows at a time.
 *
 * An import is a named road, not a batch call a script could mark: the access
 * log shows it, the documentation names it, and it is the one road a table's
 * `import: { fireEvents: false }` makes silent — no webhook delivery, no record
 * automation — while every other road writing the same table, the batch and
 * upsert routes included, fires as usual. The live stream still announces the
 * imported rows. The switch is the operator's, in the configuration; nothing in
 * the request can make an import silent.
 *
 * Each strategy writes through the road it stands for, behind that road's own
 * gates: `create` and `skip` are a batch create (`guardBatchCreate`), `overwrite`
 * an upsert on `mergeOn` (`guardUpsert`). Both duplicate checks are judged only
 * over what the caller may read, so neither reveals a record hidden from her:
 * `skip` drops, on the server, the rows whose `mergeOn` value a record she may
 * read already holds; `overwrite` refuses a `mergeOn` she may not read (`404`,
 * whether or not a record holds the value) and counts a record her row-level
 * rule hides as no match, so the row is created instead.
 * Answers `{ created, updated, skipped }`.
 */

import { Effect } from 'effect'
import { rawListRecordsProgram } from '@/application/use-cases/tables/raw-list-program'
import {
  batchCreateWithSideEffects,
  upsertWithSideEffects,
} from '@/application/use-cases/tables/record-batch-orchestration'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  importRecordsRequestSchema,
  importRecordsResponseSchema,
} from '@/domain/models/api/tables/records'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runEffect, runOnRequest } from '@/presentation/api/runtime/run-effect'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import { checkViewerPermission } from './batch-permission-helpers'
import { guardBatchCreate, guardUpsert } from './batch-write-guards'
import { getLinkReader } from './relationship-rules'
import { projectReadPredicateClause, resolveGuardForTable } from './row-level-guard'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type ImportRow = { readonly fields: Record<string, unknown> }

/** A row-level read rule as one filter clause. */
type ReadClause = Exclude<ReturnType<typeof projectReadPredicateClause>, string | undefined>

/**
 * The `mergeOn` values among `rows` that a record the caller may read already
 * holds. Empty when she may read neither the table nor the field, and when her
 * row-level read rule leaves her nothing.
 */
async function readableDuplicates(
  c: Context,
  app: App,
  mergeOn: string,
  rows: readonly ImportRow[]
): Promise<ReadonlySet<string>> {
  const { session, tableName } = getTableContext(c)
  const scope = await readScopeFor(c, app, mergeOn)
  const values = rows.map((row) => row.fields[mergeOn]).filter((v) => v !== undefined && v !== null)
  if (scope === undefined || values.length === 0) return new Set()
  const found = await runOnRequest(
    c,
    rawListRecordsProgram(session as UserSession, tableName, {
      and: [{ field: mergeOn, operator: 'in', value: values }, ...scope],
    })
  )
  return found._tag === 'Failure'
    ? new Set()
    : new Set(found.success.map((row) => String(row[mergeOn])))
}

/**
 * The extra clauses that keep a duplicate check inside what the caller may
 * read: none on a table without row-level rules, her read rule otherwise.
 * `undefined` when she may read neither the table nor the field, or when her
 * rule leaves her nothing.
 */
async function readScopeFor(
  c: Context,
  app: App,
  mergeOn: string
): Promise<readonly ReadClause[] | undefined> {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const roles = buildEffectiveRoles(userRole, userGroups)
  if (!hasReadPermissionForRoles(table, roles, app)) return undefined
  if (!isFieldReadableByCaller(app, tableName, { role: userRole, groups: userGroups }, mergeOn)) {
    return undefined
  }
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  if (guard === undefined) return []
  const clause = projectReadPredicateClause(table?.rowLevelPermissions, guard.current)
  if (clause === 'empty' || clause === undefined) return undefined
  return typeof clause === 'object' ? [clause] : []
}

/** Overwrite: an upsert on `mergeOn`, behind the upsert's gates. */
async function importOverwrite(
  c: Context,
  app: App,
  input: {
    readonly records: readonly ImportRow[]
    readonly mergeOn: string
    readonly fireEvents: boolean
  }
): Promise<Response> {
  const { session, tableName } = getTableContext(c)
  const validation = await guardUpsert(c, app, input.records, [input.mergeOn])
  if (!validation.success) return validation.response
  const program = upsertWithSideEffects({
    ...{ session, tableName, app, processEnv: process.env, fireEvents: input.fireEvents },
    recordsData: validation.strippedRecords.map((record) => record.fields),
    fieldsToMergeOn: [input.mergeOn],
    hiddenIds: validation.hiddenIds,
    returnRecords: false,
    linkReader: getLinkReader(c),
  }).pipe(Effect.map(({ created, updated }) => ({ created, updated, skipped: 0 })))
  return runEffect(c, provideDomain(c, program), importRecordsResponseSchema)
}

/** Create, or skip what is already there: a batch create, behind the batch create's gates. */
async function importCreate(
  c: Context,
  app: App,
  input: {
    readonly records: readonly ImportRow[]
    readonly mergeOn?: string
    readonly fireEvents: boolean
  }
): Promise<Response> {
  const { session, tableName } = getTableContext(c)
  const refusal = await guardBatchCreate(c, app, input.records)
  if (refusal) return refusal
  const { mergeOn } = input
  const duplicates =
    mergeOn === undefined
      ? new Set<string>()
      : await readableDuplicates(c, app, mergeOn, input.records)
  const kept = input.records.filter(
    (row) => mergeOn === undefined || !duplicates.has(String(row.fields[mergeOn]))
  )
  const skipped = input.records.length - kept.length
  if (kept.length === 0) return c.json({ created: 0, updated: 0, skipped }, 200)
  const program = batchCreateWithSideEffects({
    ...{ session, tableName, app, processEnv: process.env, fireEvents: input.fireEvents },
    linkReader: getLinkReader(c),
    rows: kept.map((row) => row.fields),
    returnRecords: false,
    isSqlite: isSqliteRuntime(),
  }).pipe(Effect.map(({ created }) => ({ created, updated: 0, skipped })))
  return runEffect(c, provideDomain(c, program), importRecordsResponseSchema)
}

/** The grants an import strategy needs: an overwrite updates too. */
const grantsFor = (strategy: string): ('create' | 'update')[] =>
  strategy === 'overwrite' ? ['create', 'update'] : ['create']

/** Import one chunk of a CSV file into the table. */
export async function handleImportRecords(c: Context, app: App) {
  const result = await validateRequest(c, importRecordsRequestSchema)
  if (!result.success) return result.response
  const { records, strategy, mergeOn } = result.data
  // A viewer the table names in none of the grants the strategy needs is refused first.
  const viewerCheck = checkViewerPermission(c, app, grantsFor(strategy))
  if (viewerCheck) return viewerCheck
  const { tableName } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  // The operator's switch, read from the configuration — never from the request.
  const fireEvents = table?.import?.fireEvents !== false
  if (strategy === 'overwrite' && mergeOn !== undefined) {
    return importOverwrite(c, app, { records, mergeOn, fireEvents })
  }
  return importCreate(c, app, {
    records,
    fireEvents,
    ...(strategy === 'skip' && mergeOn !== undefined ? { mergeOn } : {}),
  })
}
