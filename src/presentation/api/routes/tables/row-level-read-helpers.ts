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
 *   - role-gate response (403 for list, 404 for get — enumeration safety)
 *   - merged WHERE clause for list queries (drops the predicate for admins,
 *     short-circuits to "empty" when the predicate yields no records)
 *   - per-record predicate evaluation for the get-by-id post-fetch check
 *
 * Extracted to keep `record-read-handlers.ts` under the 400-line limit
 * imposed by `eslint/size-limits.config.ts`.
 */

import { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import {
  passesTableRoleGate,
  projectReadPredicateClause,
  recordPassesPredicate,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

export type FilterStructure =
  | {
      readonly and?: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    }
  | undefined

export const NOT_FOUND_RESPONSE = (c: Context): Response =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

export const EMPTY_LIST_RESPONSE = (c: Context): Response =>
  c.json({ records: [], pagination: { total: 0, limit: 0, offset: 0 } }, 200)

export interface ReadGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly userRole: string
  readonly guard: RowLevelGuardContext | undefined
}

/** Z-3 list-mode role gate. */
export function checkListReadGate(input: ReadGateInput): Response | undefined {
  const { c, app, table, userRole, guard } = input
  if (guard) {
    if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
      return c.json(
        {
          success: false,
          message: 'You do not have permission to perform this action',
          code: 'FORBIDDEN',
        },
        403
      )
    }
    return undefined
  }
  if (!hasReadPermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
}

/** Z-3 single-record role gate (404 vs 403 enumeration safety). */
export function checkGetReadGate(input: ReadGateInput): Response | undefined {
  const { c, app, table, userRole, guard } = input
  if (guard) {
    return passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)
      ? undefined
      : NOT_FOUND_RESPONSE(c)
  }
  if (!hasReadPermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
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
 * Returns 404 when the fetched fields fall outside the user's scope, or
 * the original response otherwise.
 */
export async function enforceGetReadPredicate(
  c: Context,
  response: Response,
  guard: RowLevelGuardContext | undefined,
  table: Table | undefined
): Promise<Response> {
  if (!guard || response.status !== 200 || !table?.rowLevelPermissions) return response
  const body = (await response.clone().json()) as { readonly fields?: Record<string, unknown> }
  const fields = body.fields ?? {}
  return recordPassesPredicate(table.rowLevelPermissions, 'read', fields, guard.current)
    ? response
    : NOT_FOUND_RESPONSE(c)
}
