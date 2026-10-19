/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  loadCurrentUserContext,
  rowRuleScopeOf,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import type { CallerAuthority } from './caller-authority'
import type { App, Table } from '@/domain/models/app'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

/**
 * Resolve a `CurrentUserContext` from the authenticated caller, or `undefined`
 * with no userId (only the unreachable fail-closed fallback caller): the
 * row-level gates read an absent context as "no identity" and DENY every row.
 */
export async function resolveUserContextOrUndefined(
  userId: string | undefined,
  authority: CallerAuthority,
  table: Table,
  app: App
): Promise<CurrentUserContext | undefined> {
  if (!userId) return undefined
  const projection = toSessionProjection(
    { userId },
    { role: authority.role, isUnrestricted: isAdminEquivalent(authority.role, app) }
  )
  const scope = rowRuleScopeOf(table, app.tables)
  return Effect.runPromise(
    provideTableLive(loadCurrentUserContext(projection, table.rowLevelPermissions, scope))
  )
}
