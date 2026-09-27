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
 * The row-level predicate is evaluated IN MEMORY against the fetched row
 * rather than appended to the query, because the row is already fetched and a
 * page render has no query builder of its own. {@link rowLevelCheckForVisitor}
 * is also what a collection page's `permission-blocked` answer is built from
 *, so the two paths cannot disagree about which row
 * a visitor may see.
 */

import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
  stripRestrictedColumns,
} from '@/domain/models/app/tables/read-access-plan-service'
import {
  evaluateRecordAgainstPredicate,
  isPredicateGroup,
  type CurrentUserContext,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { RowLevelWhen } from '@/domain/models/app/tables/permissions'
import type { TableLike } from '@/domain/models/app/tables/read-access-plan-service'

type RecordRow = Readonly<Record<string, unknown>>

/** "May this visitor see this row?" — `undefined` when there is nothing to ask. */
export type RowLevelReadCheck = (record: RecordRow) => Promise<boolean>

/** Extract `tableSlug` from the typed `{ kind: 'currentUser', path: ... }` form. */
function scopeFromTypedPredicateValue(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const obj = value as {
    readonly kind?: string
    readonly path?: { readonly kind?: string; readonly tableSlug?: string }
  }
  if (obj.kind !== 'currentUser') return undefined
  if (obj.path?.kind !== 'assignment') return undefined
  return typeof obj.path.tableSlug === 'string' ? obj.path.tableSlug : undefined
}

/** Extract `tableSlug` from the string-template form `$currentUser.assignments.<slug>`. */
function scopeFromTemplatePredicateValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const prefix = '$currentUser.assignments.'
  if (!value.startsWith(prefix)) return undefined
  const slug = value.slice(prefix.length)
  return slug.length > 0 ? slug : undefined
}

/**
 * The `$currentUser.assignments.<table>` scope tables a row-level predicate
 * reads, in both the typed and the string-template spelling. Mirrors the
 * application-layer `collectAssignmentScopeTables`; it stays here because the
 * page resolver runs in the presentation layer.
 */
function collectScopeTablesFromPredicate(predicate: RowLevelWhen): readonly string[] {
  // GAP-3: a composite group references scope tables across all conditions.
  if (isPredicateGroup(predicate)) {
    return predicate.conditions.flatMap(collectScopeTablesFromPredicate)
  }
  const fromTemplate = scopeFromTemplatePredicateValue(predicate.value)
  if (fromTemplate !== undefined) return [fromTemplate]
  const fromTyped = scopeFromTypedPredicateValue(predicate.value)
  if (fromTyped !== undefined) return [fromTyped]
  return []
}

/**
 * The visitor's `user_access` record ids for every scope table the predicate
 * reads, in parallel. A failed read degrades to "no assignments": the
 * predicate then fails, which is the safe direction.
 */
async function loadAssignmentsForScopes(
  userId: string,
  scopeTables: readonly string[],
  db: DataSourceDb
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (scopeTables.length === 0) return new Map<string, readonly string[]>()
  const { fetchUserAssignments: fetchAssignments } = db
  const entries = await Promise.all(
    scopeTables.map(async (slug): Promise<readonly [string, readonly string[]]> => [
      slug,
      await fetchAssignments(userId, slug).catch(() => [] as readonly string[]),
    ])
  )
  return new Map(entries)
}

/**
 * The row-level read check for one table and one SIGNED-IN visitor, or
 * `undefined` when there is nothing to check: the table declares no
 * `rowLevelPermissions.read.when`, or the visitor is unrestricted — the
 * records API lets an admin read every row, and pages mirror it.
 */
function buildRowLevelReadCheck(
  table: TableLike | undefined,
  session: SessionInfo,
  db: DataSourceDb
): RowLevelReadCheck | undefined {
  const predicate = table?.rowLevelPermissions?.read?.when
  if (!predicate) return undefined
  if (session.isUnrestricted === true || isAdminRole(session.role)) return undefined
  return async (record) => {
    const scopeTables = collectScopeTablesFromPredicate(predicate)
    const assignments = await loadAssignmentsForScopes(session.userId, scopeTables, db)
    const ctx: CurrentUserContext = {
      userId: session.userId,
      email: session.email,
      role: session.role,
      isUnrestricted: session.isUnrestricted === true,
      assignments,
    }
    return evaluateRecordAgainstPredicate(record, predicate, ctx)
  }
}

/**
 * {@link buildRowLevelReadCheck} for any visitor, signed in or not. A table
 * whose rows are scoped to the current user shows an anonymous visitor none of
 * them — the predicate has no user to be evaluated against, and failing closed
 * is what the records API's own `'unresolved'` plan does.
 */
export function rowLevelCheckForVisitor(
  table: TableLike,
  session: SessionInfo | undefined,
  db: DataSourceDb
): RowLevelReadCheck | undefined {
  if (session !== undefined) return buildRowLevelReadCheck(table, session, db)
  return table.rowLevelPermissions?.read?.when ? () => Promise.resolve(false) : undefined
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
  const { app, tableName, session, db, record } = input
  if (!app.auth) return record
  const table = (app.tables ?? []).find((t) => t.name === tableName) as TableLike | undefined
  if (table === undefined) return undefined
  // The plan `resolveRenderPlan` (`data-source-modes.ts`) builds, spelled out
  // here so that module can import this one without a cycle.
  const plan = buildReadAccessPlan({
    app,
    table,
    principal: readPrincipalFromSession(session),
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return undefined
  const check = rowLevelCheckForVisitor(table, session, db)
  if (check !== undefined && !(await check(record))) return undefined
  return stripRestrictedColumns(plan, record)
}
