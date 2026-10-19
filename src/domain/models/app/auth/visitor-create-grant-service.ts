/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a visitor who is not signed in may create a record in a table.
 *
 * The records API's rule for a signed-out create: the table's RESOLVED `create`
 * grant — after `inherit` and `override` — is the `'all'` literal. A role list,
 * `'authenticated'`, an undeclared grant and an inheritance chain that does not
 * resolve all keep the visitor out. A visitor never updates or deletes.
 */

import { isOpenToEveryone, toPermissionValue } from './permission-evaluation'
import { resolveInheritedPermissions } from './permission-evaluator-service'
import type { TablePermissions } from '@/domain/models/app/tables/permissions'

type GrantTable = Readonly<{ name: string; permissions?: TablePermissions }>

/** True when the table's resolved `create` grant is `'all'`. */
export const createOpensToEveryone = (
  table: GrantTable | undefined,
  allTables: readonly GrantTable[]
): boolean => {
  if (table?.permissions === undefined) return false
  const resolved = resolveInheritedPermissions(table, allTables)
  return isOpenToEveryone(toPermissionValue(resolved?.create))
}
