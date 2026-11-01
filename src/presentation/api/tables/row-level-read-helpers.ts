/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Z-3 row-level read enforcement helpers used by record-read-handlers.ts.
 *
 * These helpers translate the row-level guard context into the inputs the
 * list / get-by-id handlers need:
 *   - role-gate response (always 404 — S1 anti-enumeration: a denied read
 *     must not confirm the resource exists, regardless of list vs get-by-id)
 *   - merged WHERE clause for list queries (drops the predicate for admins,
 *     short-circuits to "empty" when the predicate yields no records)
 *   - per-record predicate evaluation for the get-by-id post-fetch check
 *
 * Extracted to keep `record-read-handlers.ts` under the 400-line limit
 * imposed by `[internal ref]`.
 */

import { Effect } from 'effect'
import {
  authorizeRead,
  judgeTableGrant,
  type Verdict,
} from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { emptyListRecordsResponseSchema } from '@/domain/models/api/tables/tables'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { shapedJson } from '@/presentation/api/runtime/run-effect'
import {
  projectReadPredicateClause,
  recordPassesPredicate,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * A single filter leaf clause. Mirrors the shape `buildUserFilterConditions`
 * consumes in the SQL WHERE builder.
 */
export interface FilterLeaf {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

/**
 * A nestable filter node: a leaf, an `and` group, or an `or` group.
 * The SQL WHERE builder walks this tree, emitting `( … AND … )` / `( … OR … )`.
 */
export type FilterNode =
  | FilterLeaf
  | { readonly and: readonly FilterNode[] }
  | {
      readonly or: readonly FilterNode[]
    }

export type FilterStructure =
  | {
      readonly and?: readonly FilterNode[]
    }
  | undefined

export const NOT_FOUND_RESPONSE = (c: Context): Response => notFound(c)

/**
 * The zero-row answer the LIST branch short-circuits to when the row-level read
 * predicate can admit nothing (`'empty'` / `'reject'`).
 *
 * It carries `appliedQuery: null` for the same reason every other list response
 * does: presence of the key — not its value — is what tells the grid the server
 * owns the filtering (`src/domain/models/api/search-term.ts`). Omitting it on
 * this branch alone would make "the guard denied you" indistinguishable from
 * "this endpoint does not search", so a denied grid would switch its in-memory
 * filter back on and the ROUTE's own contract would depend on the caller's
 * permissions. `null` rather than the term because nothing was applied: the
 * query never ran.
 *
 * The trash branch does NOT reach here — it has its own handler, and its
 * omission of the key is deliberate (`handleListTrash` ignores `?q=`).
 */
export const EMPTY_LIST_RESPONSE = (c: Context): Response =>
  shapedJson(
    c,
    { records: [], pagination: { total: 0, limit: 0, offset: 0 }, appliedQuery: null },
    emptyListRecordsResponseSchema
  )

/** {@link EMPTY_LIST_RESPONSE} for the trash, which carries no `appliedQuery`. */
export const EMPTY_TRASH_RESPONSE = (c: Context): Response =>
  shapedJson(
    c,
    { records: [], pagination: { total: 0, limit: 0, offset: 0 } },
    emptyListRecordsResponseSchema
  )

/**
 * The table read verdict for the list and get handlers. Under row-level rules
 * it is the read verdict for the caller the guard resolved; on a table without
 * them, the table's read grant over her effective roles (account role + every
 * `group:<name>`). Whether the caller is signed out is the session's identity —
 * the guest sentinel the auth middleware injects, or no session at all — never
 * the name of her role.
 */
function tableReadVerdict(input: ReadGateInput): Verdict {
  const { c, app, table, userRole, userGroups, guard } = input
  if (guard) return Effect.runSync(authorizeRead(table, guard))
  const session = getSessionContext(c)
  return judgeTableGrant(table, 'read', {
    effectiveRoles: buildEffectiveRoles(userRole, userGroups),
    allTables: app,
    signedOut: session === undefined || isGuestSession(session.userId),
  })
}

/**
 * Per S1 anti-enumeration, BOTH list and single-record denials return 404
 * (`NOT_FOUND_RESPONSE`): a denied read must not confirm that the table or
 * record exists.
 */
const readGateResponse = (input: ReadGateInput): Response | undefined =>
  tableReadVerdict(input)._tag === 'Allowed' ? undefined : NOT_FOUND_RESPONSE(input.c)

export interface ReadGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly userRole: string
  /**
   * Group names the user belongs to (un-prefixed). Combined with `userRole`
   * for most-permissive-wins evaluation of `group:<name>` permissions.
   */
  readonly userGroups: readonly string[]
  readonly guard: RowLevelGuardContext | undefined
}

/**
 * Z-3 list-mode role gate. Returns 404 on denial (S1 anti-enumeration:
 * uniform with `checkGetReadGate` so list and get-by-id are indistinguishable
 * to an unauthorized caller).
 */
export function checkListReadGate(input: ReadGateInput): Response | undefined {
  return readGateResponse(input)
}

/**
 * Z-3 single-record role gate. Single-record read denial is a 404
 * (S1 anti-enumeration) for BOTH the row-level-scoped and the role-only
 * paths — a denied fetch must not confirm the record's existence.
 */
export function checkGetReadGate(input: ReadGateInput): Response | undefined {
  return readGateResponse(input)
}

/**
 * Combine a view filter, a request filter, and the row-level read
 * predicate into a single AND-merged filter. Sentinels:
 *   - `'empty'`  — predicate resolves to "match nothing" (e.g. `IN []`)
 *   - `'reject'` — predicate could not be projected (caller short-circuits)
 */
export function buildListFilter(
  table: Table | undefined,
  guard: RowLevelGuardContext | undefined,
  viewFilter: FilterStructure,
  reqFilter: FilterStructure
): FilterStructure | 'empty' | 'reject' {
  const merged = mergeFilters(viewFilter, reqFilter)
  if (!guard || !table?.rowLevelPermissions) return merged

  const clause = projectReadPredicateClause(table.rowLevelPermissions, guard.current)
  if (clause === 'bypass' || clause === 'no-rlp') return merged
  if (clause === 'empty') return 'empty'
  if (clause === undefined) return 'reject'
  return mergeFilters(merged, { and: [clause] })
}

/** AND-merge two filter structures. Empty results collapse to undefined. */
export function mergeFilters(
  viewFilter: FilterStructure,
  reqFilter: FilterStructure
): FilterStructure {
  const viewConds = viewFilter?.and ?? []
  const reqConds = reqFilter?.and ?? []
  const combined = [...viewConds, ...reqConds]
  if (combined.length === 0) return undefined
  return { and: combined }
}

/**
 * The single read's row-level check, asked of the STORED row by the program
 * before any column the reader may not read is stripped — `undefined` when
 * there is nothing to check (no guard, or no row-level rules).
 *
 * The rule reads the stored row, as the list's SQL projection reads it and as
 * the record gate does, so a rule on a column hidden from the reader judges
 * the value it was written with — never the response after that column has
 * been masked. The row is read as the records API reads it (SQLite `1`/`0`
 * as booleans) before the rule sees it.
 */
export function readRuleAdmits(
  guard: RowLevelGuardContext | undefined,
  table: Table | undefined
): ((stored: Readonly<Record<string, unknown>>) => boolean) | undefined {
  const rlp = table?.rowLevelPermissions
  if (!guard || !rlp) return undefined
  return (stored) =>
    recordPassesPredicate(rlp, 'read', readStoredValues(table, stored), guard.current)
}
