/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hasReadPermissionForRoles } from '@/application/use-cases/tables/permissions/permissions'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
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

export const FORBIDDEN_RESPONSE = (c: Context): Response =>
  c.json(
    {
      success: false,
      message: 'You do not have permission to perform this action',
      code: 'FORBIDDEN',
    },
    403
  )

export const EMPTY_LIST_RESPONSE = (c: Context): Response =>
  c.json({ records: [], pagination: { total: 0, limit: 0, offset: 0 } }, 200)

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
  readonly userGroups: readonly string[]
  readonly guard: RowLevelGuardContext | undefined
}

export function checkListReadGate(input: ReadGateInput): Response | undefined {
  const { c, table, guard } = input
  if (guard) {
    return passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)
      ? undefined
      : FORBIDDEN_RESPONSE(c)
  }
  return checkRoleOnlyReadGate(input, FORBIDDEN_RESPONSE)
}

export function checkGetReadGate(input: ReadGateInput): Response | undefined {
  const { c, table, guard } = input
  if (guard) {
    return passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)
      ? undefined
      : NOT_FOUND_RESPONSE(c)
  }
  return checkRoleOnlyReadGate(input, NOT_FOUND_RESPONSE)
}

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
