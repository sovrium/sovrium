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

import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { hasReadPermissionForRoles } from '@/domain/validators/permission-evaluators'
import {
  passesTableRoleGate,
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
 * A nestable filter node (GAP-3): a leaf, an `and` group, or an `or` group.
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

export const NOT_FOUND_RESPONSE = (c: Context): Response =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

export const EMPTY_LIST_RESPONSE = (c: Context): Response =>
  c.json({ records: [], pagination: { total: 0, limit: 0, offset: 0 } }, 200)

/**
 * Non-guard (role-only) read gate shared by the list and get handlers:
 * evaluate the table read permission against the user's effective roles
 * (global role + every `group:<name>`).
 *
 * `onDeny` selects the denial response shape. Per S1 anti-enumeration, BOTH
 * list and single-record denials return 404 (`NOT_FOUND_RESPONSE`): a denied
 * read must not confirm that the table or record exists. `FORBIDDEN_RESPONSE`
 * is kept exported for legitimate non-authz uses, but the read gates always
 * pass `NOT_FOUND_RESPONSE` as `onDeny`.
 */
function checkRoleOnlyReadGate(
  input: ReadGateInput,
  onDeny: (c: Context) => Response
): Response | undefined {
  const { c, app, table, userRole, userGroups } = input
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  return hasReadPermissionForRoles(table, effectiveRoles, app.tables) ? undefined : onDeny(c)
}

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
  const { c, table, guard } = input
  if (guard) {
    return passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)
      ? undefined
      : NOT_FOUND_RESPONSE(c)
  }
  return checkRoleOnlyReadGate(input, NOT_FOUND_RESPONSE)
}

/**
 * Z-3 single-record role gate. Single-record read denial is a 404
 * (S1 anti-enumeration) for BOTH the row-level-scoped and the role-only
 * paths — a denied fetch must not confirm the record's existence.
 */
export function checkGetReadGate(input: ReadGateInput): Response | undefined {
  const { c, table, guard } = input
  if (guard) {
    return passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)
      ? undefined
      : NOT_FOUND_RESPONSE(c)
  }
  return checkRoleOnlyReadGate(input, NOT_FOUND_RESPONSE)
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
 * Apply the row-level read predicate post-fetch to a 200 GET response.
 * Returns 404 when the fetched record falls outside the user's scope, or
 * the original response otherwise.
 *
 * The single-record GET response carries `id` at the top level and the
 * column values under `fields`. A read predicate keyed on `id` (e.g. the
 * common `id IN [...]` per-tenant scope sourced from `system.user_access`)
 * must therefore see the top-level `id` merged into the evaluated record —
 * otherwise `id` resolves `undefined`, the predicate is always false, and a
 * user is 404'd off a record they are legitimately assigned to.
 */
export async function enforceGetReadPredicate(
  c: Context,
  response: Response,
  guard: RowLevelGuardContext | undefined,
  table: Table | undefined
): Promise<Response> {
  if (!guard || response.status !== 200 || !table?.rowLevelPermissions) return response
  const body = (await response.clone().json()) as {
    readonly id?: string | number
    readonly fields?: Record<string, unknown>
  }
  const record = { ...(body.fields ?? {}), id: body.id }
  return recordPassesPredicate(table.rowLevelPermissions, 'read', record, guard.current)
    ? response
    : NOT_FOUND_RESPONSE(c)
}
